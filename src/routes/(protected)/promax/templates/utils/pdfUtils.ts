import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const CAPTURE_SCALE = 3;
const EXPORT_CLASS = 'exporting-pdf';

const A4_W_MM = 210;
const A4_H_MM = 297;

export async function exportPdf(templateEl: HTMLDivElement) {
	templateEl.classList.add(EXPORT_CLASS);

	try {
		const canvas = await html2canvas(templateEl, {
			scale: CAPTURE_SCALE,
			useCORS: true,
			backgroundColor: null
		});

		const imgData = canvas.toDataURL('image/png');
		const pxToMm = 25.4 / 96;
		const templateWMm = (canvas.width / CAPTURE_SCALE) * pxToMm;
		const templateHMm = (canvas.height / CAPTURE_SCALE) * pxToMm;

		const scale = Math.min(A4_W_MM / templateWMm, A4_H_MM / templateHMm, 1);
		const imgW = templateWMm * scale;
		const imgH = templateHMm * scale;
		const offsetX = (A4_W_MM - imgW) / 2;
		const offsetY = (A4_H_MM - imgH) / 2;

		const doc = new jsPDF({ unit: 'mm', format: 'a4' });
		doc.addImage(imgData, 'PNG', offsetX, offsetY, imgW, imgH);
		doc.save('promax-template.pdf');
	} finally {
		templateEl.classList.remove(EXPORT_CLASS);
	}
}
