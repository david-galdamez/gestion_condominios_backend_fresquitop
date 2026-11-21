import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsNormalizedEmail } from '@Common/decorators';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email del usuario. Se normaliza a minúsculas y sin espacios.',
    example: 'nestor@example.com',
    format: 'email',
    maxLength: 254,
  })
  @IsNormalizedEmail()
  email!: string;

  @ApiProperty({
    description: 'Contraseña. Debe incluir al menos una minúscula, una mayúscula y un número.',
    example: 'Str0ngPass',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  // bcrypt trunca silenciosamente en 72 bytes, así que se rechaza antes de hashear.
  @MaxLength(72, { message: 'La contraseña no puede superar los 72 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contraseña debe incluir al menos una minúscula, una mayúscula y un número.',
  })
  password!: string;

  @ApiProperty({ description: 'Nombre completo.', example: 'Residente Uno', maxLength: 120 })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({
    description: 'Unidades que habita el residente (deben existir y estar activas).',
    type: [String],
    format: 'uuid',
    example: ['0b5e3c1e-7f0a-4c55-9a53-2f4f3f5f0a11'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'No se pueden asignar más de 20 unidades.' })
  @ArrayUnique({ message: 'Las unidades no pueden repetirse.' })
  @IsUUID('all', { each: true, message: 'Cada unidad debe ser un UUID válido.' })
  unidadIds?: string[];

  // El rol no se acepta en el body: todo usuario queda como RESIDENTE
  // (default de la base). La asignación de roles será responsabilidad de un flujo de administración.
}
