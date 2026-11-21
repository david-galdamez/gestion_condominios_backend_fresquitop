import { ApiProperty } from '@nestjs/swagger';

/** Datos de un residente tal como los vería el directorio (null = no se muestra o no existe). */
export class DatosDirectorioDto {
  @ApiProperty({ nullable: true, type: String, example: 'Ana López' })
  nombre!: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'A-101', description: 'Si tiene varias: "A-101, B-205".' })
  unidad!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '7044-2727',
    description: 'Teléfono que el residente registró en "Mi directorio" (null si no tiene).',
  })
  telefono!: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'ana@correo.com' })
  correo!: string | null;
}

export class PerfilDirectorioDto {
  @ApiProperty()
  visible!: boolean;

  @ApiProperty()
  mostrarNombre!: boolean;

  @ApiProperty()
  mostrarUnidad!: boolean;

  @ApiProperty()
  mostrarTelefono!: boolean;

  @ApiProperty()
  mostrarCorreo!: boolean;

  @ApiProperty({
    type: DatosDirectorioDto,
    description: 'Todos los datos propios, para que la pantalla arme la vista previa al marcar casillas.',
  })
  misDatos!: DatosDirectorioDto;

  @ApiProperty({
    type: DatosDirectorioDto,
    nullable: true,
    description: 'Cómo lo ven los vecinos: solo los datos marcados; null si está oculto.',
  })
  vistaPrevia!: DatosDirectorioDto | null;
}
