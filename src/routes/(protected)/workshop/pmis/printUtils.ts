import html2canvas from 'html2canvas';

const CAPTURE_SCALE = 2;

/** Replace form controls with static text so html2canvas matches on-screen values. */
function prepareCloneForCapture(root: HTMLElement): void {
	root.querySelectorAll<HTMLInputElement>('input[type="text"]').forEach((input) => {
		const span = document.createElement('span');
		span.textContent = input.value;
		span.className = input.className;
		span.style.display = 'block';
		span.style.width = '100%';
		span.style.padding = '2px 0';
		span.style.font = 'inherit';
		span.style.color = 'inherit';
		span.style.whiteSpace = 'pre-wrap';
		span.style.minHeight = `${input.offsetHeight}px`;
		input.replaceWith(span);
	});

	root.querySelectorAll<HTMLTextAreaElement>('textarea').forEach((textarea) => {
		const div = document.createElement('div');
		div.textContent = textarea.value;
		div.className = textarea.className;
		div.style.whiteSpace = 'pre-wrap';
		div.style.width = '100%';
		div.style.padding = '2px 0';
		div.style.font = 'inherit';
		div.style.color = 'inherit';
		div.style.minHeight = `${textarea.offsetHeight}px`;
		textarea.replaceWith(div);
	});

	root.querySelectorAll<HTMLInputElement>('.status-checkbox input[type="checkbox"]').forEach((input) => {
		input.style.display = 'none';
	});

	root.querySelectorAll<HTMLInputElement>('.checkbox-row input[type="checkbox"]').forEach((input) => {
		input.style.width = '14px';
		input.style.height = '14px';
		input.style.flexShrink = '0';
	});
}

export async function printSheetElement(sheetEl: HTMLElement): Promise<void> {
	const pageEl = sheetEl.closest('.pmis-page') ?? sheetEl;
	const pageStyles = window.getComputedStyle(pageEl);

	const wrapper = document.createElement('div');
	wrapper.className = 'pmis-page';
	wrapper.style.position = 'fixed';
	wrapper.style.left = '-9999px';
	wrapper.style.top = '0';
	wrapper.style.width = `${sheetEl.offsetWidth}px`;
	wrapper.style.background = '#fff';
	wrapper.style.padding = '0';
	wrapper.style.fontFamily = pageStyles.fontFamily;
	wrapper.style.fontSize = pageStyles.fontSize;
	wrapper.style.color = pageStyles.color;

	const clone = sheetEl.cloneNode(true) as HTMLElement;
	wrapper.appendChild(clone);
	document.body.appendChild(wrapper);

	try {
		prepareCloneForCapture(clone);

		const canvas = await html2canvas(wrapper, {
			scale: CAPTURE_SCALE,
			useCORS: true,
			backgroundColor: '#ffffff',
			logging: false
		});

		const imgData = canvas.toDataURL('image/png');
		const printWindow = window.open('', '_blank');
		if (!printWindow) {
			throw new Error('Please allow pop-ups to print the form');
		}

		printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>PMIS — Print</title>
  <style>
    @page { margin: 8mm; size: auto; }
    html, body { margin: 0; padding: 0; background: #fff; }
    img { display: block; width: 100%; height: auto; }
  </style>
</head>
<body>
  <img src="${imgData}" alt="PMIS form" />
  <script>
    window.onload = function () {
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  <\/script>
</body>
</html>`);
		printWindow.document.close();
	} finally {
		wrapper.remove();
	}
}
