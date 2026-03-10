import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const CAPTURE_SCALE = 3;
const EXPORT_CLASS = 'exporting-pdf';

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
		const wMm = (canvas.width / CAPTURE_SCALE) * pxToMm;
		const hMm = (canvas.height / CAPTURE_SCALE) * pxToMm;

		const doc = new jsPDF({
			unit: 'mm',
			format: [wMm, hMm]
		});

		doc.addImage(imgData, 'PNG', 0, 0, wMm, hMm);
		doc.save('promax-template.pdf');
	} finally {
		templateEl.classList.remove(EXPORT_CLASS);
	}
}
