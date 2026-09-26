import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

interface PayslipPdfInput {
  tenantName: string;
  tenantLogoPng?: Buffer; // logo del tenant en PNG (descargado desde TenantBranding.logoUrl)
  employeeFullName: string;
  employeeCode: string;
  periodMonth: number;
  periodYear: number;
  grossSalary: string;
  totalDeductions: string;
  netSalary: string;
  currency: string;
  lines: { label: string; amount: string; kind: 'EARNING' | 'DEDUCTION' }[];
}

/**
 * Genera el PDF del rol de pagos (solo lectura) con marca de agua del logo
 * de la empresa repetida en diagonal, para evitar que el documento se use
 * fuera de contexto o se confunda entre empresas del mismo grupo.
 */
@Injectable()
export class PdfWatermarkService {
  async generatePayslipPdf(input: PayslipPdfInput): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    if (input.tenantLogoPng) {
      const logoImage = await pdfDoc.embedPng(input.tenantLogoPng);
      const dims = logoImage.scale(0.25);
      page.drawImage(logoImage, {
        x: 40,
        y: 780,
        width: dims.width,
        height: dims.height,
      });
      await this.drawWatermark(pdfDoc, page, logoImage);
    } else {
      await this.drawTextWatermark(page, font, input.tenantName);
    }

    let y = 740;
    page.drawText(input.tenantName, { x: 40, y, size: 16, font: fontBold });
    y -= 30;
    page.drawText(`Rol de pagos - ${input.periodMonth}/${input.periodYear}`, {
      x: 40,
      y,
      size: 12,
      font,
    });
    y -= 20;
    page.drawText(`${input.employeeFullName} (${input.employeeCode})`, {
      x: 40,
      y,
      size: 12,
      font,
    });

    y -= 40;
    for (const line of input.lines) {
      const sign = line.kind === 'DEDUCTION' ? '-' : '';
      page.drawText(line.label, { x: 40, y, size: 10, font });
      page.drawText(`${sign}${line.amount} ${input.currency}`, { x: 420, y, size: 10, font });
      y -= 16;
    }

    y -= 20;
    page.drawText('Total haberes:', { x: 40, y, size: 11, font: fontBold });
    page.drawText(`${input.grossSalary} ${input.currency}`, { x: 420, y, size: 11, font: fontBold });
    y -= 16;
    page.drawText('Total deducciones:', { x: 40, y, size: 11, font: fontBold });
    page.drawText(`-${input.totalDeductions} ${input.currency}`, { x: 420, y, size: 11, font: fontBold });
    y -= 16;
    page.drawText('Neto a pagar:', { x: 40, y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.4) });
    page.drawText(`${input.netSalary} ${input.currency}`, {
      x: 420,
      y,
      size: 13,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.4),
    });

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  private async drawTextWatermark(page: any, font: any, text: string) {
    const { width, height } = page.getSize();
    for (let x = -100; x < width + 100; x += 220) {
      for (let y = 0; y < height + 100; y += 160) {
        page.drawText(text.toUpperCase(), {
          x,
          y,
          size: 24,
          font,
          rotate: degrees(35),
          opacity: 0.08,
        });
      }
    }
  }

  private async drawWatermark(pdfDoc: PDFDocument, page: any, image: any) {
    const { width, height } = page.getSize();
    const scaled = image.scale(0.18);
    for (let x = -100; x < width + 100; x += scaled.width + 60) {
      for (let y = 0; y < height + 100; y += scaled.height + 60) {
        page.drawImage(image, {
          x,
          y,
          width: scaled.width,
          height: scaled.height,
          rotate: degrees(35),
          opacity: 0.08,
        });
      }
    }
  }
}
