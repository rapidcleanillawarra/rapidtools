<script lang="ts">
	export let totalBalance = 0;
	export let totalPayments = 0;
	export let paymentDifference = 0;
</script>

<div class="mb-6 p-4 bg-[#181b20] border border-[#262a30] rounded-xl shadow-sm">
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-sm">
		<div class="flex flex-wrap gap-6">
			<div>
				<span class="font-medium text-gray-400">Total Balance:</span>
				<span class="ml-2 font-semibold text-white">${totalBalance.toFixed(2)}</span>
			</div>
			<div>
				<span class="font-medium text-gray-400">Total Payments:</span>
				<span class="ml-2 font-semibold text-lime-400">${totalPayments.toFixed(2)}</span>
			</div>
		</div>
		<div class="text-xs text-gray-400">
			Difference:
			<span
				class="font-semibold text-sm ml-1"
				class:text-red-400={paymentDifference > 0}
				class:text-lime-400={paymentDifference <= 0}
			>
				${paymentDifference.toFixed(2)}
			</span>
		</div>
	</div>
</div>
