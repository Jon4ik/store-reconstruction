import { IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

const WORK_TYPES = ['Закрытие', 'Реконструкция', 'Открытие'];
const STATUSES = ['Запланирован', 'В работе', 'Завершено', 'Просрочено', 'Отменено', 'Отмена', 'Закрыт для покупателей', 'Демонтаж', 'Монтаж', 'Техническое открытие', 'Открытие', 'Удален'];

export class CreateStoreDto {
  @IsString() @Length(1, 100) storeNumber!: string;
  @IsIn(WORK_TYPES) workType!: string;
  @IsString() @Length(1, 100) tuId!: string;
  @IsOptional() @IsString() @MaxLength(32) rowColor?: string;
  @IsOptional() @IsString() @MaxLength(5000) comment?: string;
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsString() @MaxLength(80) manualStatus?: string | null;
  @IsOptional() @IsString() @MaxLength(30) closureDate?: string | null;
  @IsOptional() @IsString() @MaxLength(30) demolitionDate?: string | null;
  @IsOptional() @IsString() @MaxLength(30) installationDate?: string | null;
  @IsOptional() @IsString() @MaxLength(30) techOpenDate?: string | null;
}

export class UpdateStoreDto {
  @IsOptional() @IsString() @Length(1, 100) storeNumber?: string;
  @IsOptional() @IsIn(WORK_TYPES) workType?: string;
  @IsOptional() @IsString() @Length(1, 100) tuId?: string;
  @IsOptional() @IsString() @MaxLength(32) rowColor?: string;
  @IsOptional() @IsString() @MaxLength(5000) comment?: string;
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsString() @MaxLength(80) manualStatus?: string | null;
  @IsOptional() @IsString() @MaxLength(30) closureDate?: string | null;
  @IsOptional() @IsString() @MaxLength(30) demolitionDate?: string | null;
  @IsOptional() @IsString() @MaxLength(30) installationDate?: string | null;
  @IsOptional() @IsString() @MaxLength(30) techOpenDate?: string | null;
}

export class StoreQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsIn(WORK_TYPES) workType?: string;
  @IsOptional() @IsString() @MaxLength(80) status?: string;
  @IsOptional() @IsString() @MaxLength(100) tuId?: string;
  @IsOptional() @IsString() @MaxLength(150) city?: string;
}

export class AddCommentDto {
  @IsString() @Length(1, 5000) text!: string;
}
