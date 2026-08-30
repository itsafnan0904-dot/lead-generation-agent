import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { UserRole } from '@ai-sales-agent/database';

describe('AuthController & Guards (e2e/controller tests)', () => {
  let app: INestApplication;
  let authService: any;

  const mockUser = {
    id: 'user-uuid-9999',
    email: 'sarah@example.com',
    name: 'Sarah Jenkins',
    role: UserRole.MANAGER,
  };

  const mockTokens = {
    accessToken: 'valid.access.jwt',
    refreshToken: 'valid.refresh.jwt',
    expiresIn: '15m',
  };

  const mockGoogleProfile = {
    googleId: 'google-sub-5555',
    email: 'sarah@example.com',
    name: 'Sarah Jenkins',
  };

  beforeAll(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      handleGoogleLogin: jest.fn(),
      confirmGoogleLink: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          const authHeader = req.headers['authorization'];
          if (authHeader === 'Bearer valid.access.jwt') {
            req.user = mockUser;
            return true;
          }
          return false;
        },
      })
      .overrideGuard(GoogleAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          // Simulate passport setting req.user after Google strategy validation
          req.user = mockGoogleProfile;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /auth/me succeeds with a valid access token', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer valid.access.jwt')
      .expect(200);

    expect(response.body).toEqual({ user: mockUser });
  });

  it('GET /auth/me is rejected (403/401) without a token or with an invalid token', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .expect(403);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid.token.xyz')
      .expect(403);
  });

  it('POST /auth/register invokes authService.register and returns 201', async () => {
    authService.register.mockResolvedValue({
      user: mockUser,
      tokens: mockTokens,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'sarah@example.com',
        name: 'Sarah Jenkins',
        password: 'Password123!',
      })
      .expect(201);

    expect(response.body.user.email).toBe('sarah@example.com');
    expect(response.body.tokens.accessToken).toBe('valid.access.jwt');
  });

  it('POST /auth/login invokes authService.login and returns 200', async () => {
    authService.login.mockResolvedValue({
      user: mockUser,
      tokens: mockTokens,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'sarah@example.com',
        password: 'Password123!',
      })
      .expect(200);

    expect(response.body.tokens.accessToken).toBe('valid.access.jwt');
  });

  it('POST /auth/refresh invokes authService.refresh and returns 200', async () => {
    authService.refresh.mockResolvedValue(mockTokens);

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken: 'valid.refresh.jwt',
      })
      .expect(200);

    expect(response.body.accessToken).toBe('valid.access.jwt');
  });

  it('POST /auth/logout invokes authService.logout and returns 200 when authenticated', async () => {
    authService.logout.mockResolvedValue({ success: true });

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer valid.access.jwt')
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(authService.logout).toHaveBeenCalledWith(mockUser.id);
  });

  it('GET /auth/google triggers Google guard and route handler', async () => {
    await request(app.getHttpServer())
      .get('/auth/google')
      .expect(200);
  });

  it('GET /auth/google/callback delegates req.user to handleGoogleLogin and returns response', async () => {
    authService.handleGoogleLogin.mockResolvedValue({
      user: mockUser,
      tokens: mockTokens,
    });

    const response = await request(app.getHttpServer())
      .get('/auth/google/callback')
      .expect(200);

    expect(authService.handleGoogleLogin).toHaveBeenCalledWith(mockGoogleProfile);
    expect(response.body.tokens.accessToken).toBe('valid.access.jwt');
  });

  it('POST /auth/google/confirm-link invokes authService.confirmGoogleLink and returns 200', async () => {
    authService.confirmGoogleLink.mockResolvedValue({
      user: mockUser,
      tokens: mockTokens,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/google/confirm-link')
      .send({
        linkToken: 'valid.link.token.xyz',
        password: 'Password123!',
      })
      .expect(200);

    expect(response.body.user.email).toBe('sarah@example.com');
    expect(response.body.tokens.accessToken).toBe('valid.access.jwt');
  });
});
