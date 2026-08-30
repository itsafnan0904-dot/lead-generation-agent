import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmGoogleLinkDto {
  @IsString()
  @IsNotEmpty({ message: 'Link token is required' })
  linkToken!: string;

  @IsString()
  @IsNotEmpty({ message: 'Existing account password is required to verify account ownership' })
  password!: string;
}
