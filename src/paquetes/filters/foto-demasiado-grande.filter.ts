import { ArgumentsHost, Catch, HttpStatus, PayloadTooLargeException, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { MSG_FOTO } from '../dto/registrar-paquete.dto.js';

/**
 * Multer corta la subida al pasar de 5 MB con 413 "File too large". La
 * historia pide 400 con el mensaje "Solo JPG o PNG de hasta 5 MB".
 */
@Catch(PayloadTooLargeException)
export class FotoDemasiadoGrandeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.BAD_REQUEST)
      .json({ message: MSG_FOTO, error: 'Bad Request', statusCode: HttpStatus.BAD_REQUEST });
  }
}
