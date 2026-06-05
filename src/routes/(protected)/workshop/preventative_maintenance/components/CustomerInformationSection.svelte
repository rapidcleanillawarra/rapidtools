<script lang="ts">
	import WorkshopOrderCombobox, {
		type WorkshopOrderOption
	} from './WorkshopOrderCombobox.svelte';

	interface Props {
		workshopOrderId?: string;
		customer?: string;
		email?: string;
		address?: string;
		phone?: string;
		city?: string;
		state?: string;
		zip?: string;
		contact?: string;
		comboboxId?: string;
		onWorkshopOrderSelect?: (option: WorkshopOrderOption) => void;
	}

	let {
		workshopOrderId = $bindable(''),
		customer = $bindable(''),
		email = $bindable(''),
		address = $bindable(''),
		phone = $bindable(''),
		city = $bindable(''),
		state = $bindable(''),
		zip = $bindable(''),
		contact = $bindable(''),
		comboboxId = 'workshop-order-id',
		onWorkshopOrderSelect
	}: Props = $props();
</script>

<table class="form-table cell-stack" aria-label="Customer information">
	<tbody>
		<tr class="section-bar"><th colspan="4">Customer Information</th></tr>
		<tr>
			<td class="label-cell">Workshop Order ID:</td>
			<td class="field-cell" colspan="3">
				<WorkshopOrderCombobox
					id={comboboxId}
					bind:value={workshopOrderId}
					onselect={onWorkshopOrderSelect}
				/>
			</td>
		</tr>
		<tr>
			<td class="label-cell">Customer:</td>
			<td class="field-cell">
				<input class="field" type="text" bind:value={customer} autocomplete="organization" />
			</td>
			<td class="label-cell">Email:</td>
			<td class="field-cell">
				<input class="field" type="email" bind:value={email} autocomplete="email" />
			</td>
		</tr>
		<tr>
			<td class="label-cell">Address:</td>
			<td class="field-cell">
				<input class="field" type="text" bind:value={address} autocomplete="street-address" />
			</td>
			<td class="label-cell">Phone:</td>
			<td class="field-cell">
				<input class="field" type="tel" bind:value={phone} autocomplete="tel" />
			</td>
		</tr>
		<tr>
			<td class="label-cell city-label">City:</td>
			<td class="field-cell city-field">
				<input class="field" type="text" bind:value={city} autocomplete="address-level2" />
			</td>
			<td class="label-cell state-label">State:</td>
			<td class="field-cell state-field">
				<input class="field" type="text" bind:value={state} autocomplete="address-level1" />
			</td>
		</tr>
		<tr>
			<td class="label-cell zip-label">Zip:</td>
			<td class="field-cell zip-field">
				<input class="field" type="text" bind:value={zip} autocomplete="postal-code" />
			</td>
			<td class="label-cell">Contact:</td>
			<td class="field-cell">
				<input class="field" type="text" bind:value={contact} autocomplete="name" />
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

	.city-label,
	.state-label,
	.zip-label {
		width: 12%;
	}

	.city-field,
	.state-field,
	.zip-field {
		width: 13%;
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
