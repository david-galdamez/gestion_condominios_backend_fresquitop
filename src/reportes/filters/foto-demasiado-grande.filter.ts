import { ArgumentsHost, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'express';
import { MENSAJE_FOTOS } from '../reportes.constants.js';

/**
 * Multer corta con 413 cuando un archivo pasa el límite de tamaño. El contrato
 * del endpoint pide 400 con el mensaje de negocio, así que se traduce acá.
 */
@Catch(PayloadTooLargeException)
export class FotoDemasiadoGrandeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(400).json({ message: MENSAJE_FOTOS, error: 'Bad Request', statusCode: 400 });
  }
}
