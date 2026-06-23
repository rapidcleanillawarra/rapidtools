<script lang="ts">
	export let totalBalance = 0;
	export let totalPayments = 0;
	export let paymentDifference = 0;
</script>

<div class="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
	<div class="flex justify-between items-center text-sm">
		<div class="flex space-x-6">
			<div>
				<span class="font-medium text-gray-700">Total Balance:</span>
				<span class="ml-2 font-semibold text-blue-600">${totalBalance.toFixed(2)}</span>
			</div>
			<div>
				<span class="font-medium text-gray-700">Total Payments:</span>
				<span class="ml-2 font-semibold text-green-600">${totalPayments.toFixed(2)}</span>
			</div>
		</div>
		<div class="text-xs text-gray-500">
			Difference:
			<span
				class="font-medium"
				class:text-red-600={paymentDifference > 0}
				class:text-green-600={paymentDifference <= 0}
			>
				${paymentDifference.toFixed(2)}
			</span>
		</div>
	</div>
</div>
