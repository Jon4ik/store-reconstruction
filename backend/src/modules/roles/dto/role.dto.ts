import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString() @Length(2, 80) name!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsArray() @ArrayMaxSize(64) @IsString({ each: true }) permissions!: string[];
  @IsOptional() @IsBoolean() isSystem?: boolean;
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @Length(2, 80) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(64) @IsString({ each: true }) permissions?: string[];
  @IsOptional() @IsBoolean() isSystem?: boolean;
}
