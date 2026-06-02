<script lang="ts">
	interface Props {
		serialNumber?: string;
		hourMeterKey?: string;
		modelNumber?: string;
		hourMeterTraction?: string;
		workOrderNumber?: string;
		hourMeterScrub?: string;
		rechargeNumber?: string;
		hourMeterVacuum?: string;
	}

	let {
		serialNumber = $bindable(''),
		hourMeterKey = $bindable(''),
		modelNumber = $bindable(''),
		hourMeterTraction = $bindable(''),
		workOrderNumber = $bindable(''),
		hourMeterScrub = $bindable(''),
		rechargeNumber = $bindable(''),
		hourMeterVacuum = $bindable('')
	}: Props = $props();
</script>

<table class="form-table cell-stack" aria-label="Machine information">
	<tbody>
		<tr class="section-bar"><th colspan="4">Machine Information</th></tr>
		<tr>
			<td class="label-cell">Serial #:</td>
			<td class="field-cell">
				<input class="field" type="text" bind:value={serialNumber} />
			</td>
			<td class="label-cell">Hour Meter (Key):</td>
			<td class="field-cell">
				<input class="field" type="text" bind:value={hourMeterKey} />
			</td>
		</tr>
		<tr>
			<td class="label-cell">Model #:</td>
			<td class="field-cell">
				<input class="field" type="text" bind:value={modelNumber} />
			</td>
			<td class="label-cell">Hour Meter (Traction):</td>
			<td class="field-cell">
				<input class="field" type="text" bind:value={hourMeterTraction} />
			</td>
		</tr>
		<tr>
			<td class="label-cell">Work Order #:</td>
			<td class="field-cell">
				<input class="field" type="text" bind:value={workOrderNumber} />
			</td>
			<td class="label-cell">Hour Meter (Scrub):</td>
			<td class="field-cell">
				<input class="field" type="text" bind:value={hourMeterScrub} />
			</td>
		</tr>
		<tr>
			<td class="label-cell">Recharge #:</td>
			<td class="field-cell">
				<input class="field" type="text" bind:value={rechargeNumber} />
			</td>
			<td class="label-cell">Hour Meter (Vacuum):</td>
			<td class="field-cell">
				<input class="field" type="text" bind:value={hourMeterVacuum} />
			</td>
		</tr>
	</tbody>
</table>

<style>
	table.form-table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		margin-bottom: 0;
	}

	table.form-table td,
	table.form-table th {
		border: 1px solid #000;
		vertical-align: top;
		padding: 4px 6px;
	}

	.section-bar th {
		background: #000;
		color: #fff;
		font-weight: bold;
		text-transform: uppercase;
		padding: 6px 8px;
		border: 1px solid #000;
		font-size: 10pt;
		letter-spacing: 0.02em;
	}

	.label-cell {
		font-size: 9pt;
		width: 22%;
		padding: 2px 6px 6px;
	}

	.field-cell {
		padding: 2px 6px 6px;
		width: 28%;
	}

	.cell-stack .label-cell,
	.cell-stack .field-cell {
		padding-top: 4px;
	}

	input.field {
		width: 100%;
		border: none;
		outline: none;
		font: inherit;
		background: transparent;
		padding: 2px 0;
		margin: 0;
	}
</style>
