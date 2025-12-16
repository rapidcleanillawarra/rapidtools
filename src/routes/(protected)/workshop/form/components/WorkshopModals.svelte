<script lang="ts">
  import SuccessModal from '$lib/components/SuccessModal.svelte';
  import PostSubmissionModal from '$lib/components/PostSubmissionModal.svelte';
  import PhotoViewer from '$lib/components/PhotoViewer.svelte';
  import type { Customer } from '$lib/services/customers';

  export let showSuccessModal: boolean;
  export let successMessage: string;
  export let generatedOrderId: string;
  export let closeSuccessModal: () => void;

  export let showPostSubmissionModal: boolean;
  export let action: string;
  export let navigateToWorkshopBoard: () => void;

  export let showIncompleteContactModal: boolean;
  export let clearIncompleteContact: () => void;

  export let showPhotoViewer: boolean;
  export let photoUrls: string[];
  export let currentPhotoIndex: number;
  export let closePhotoViewer: () => void;

  export let showPickupSubmissionModal: boolean;

  export let showPickupStatusChangeModal: boolean;
  export let closePickupStatusChangeModal: () => void;

  export let showDocketReadyModal: boolean;
  export let closeDocketReadyModal: () => void;

  export let showWaitingApprovalModal: boolean;
  export let closeWaitingApprovalModal: () => void;

  export let showWaitingForPartsModal: boolean;
  export let closeWaitingForPartsModal: () => void;

  export let showBookedInRepairModal: boolean;
  export let closeBookedInRepairModal: () => void;

  export let showRepairedModal: boolean;
  export let closeRepairedModal: () => void;

  export let showReturnModal: boolean;
  export let closeReturnModal: () => void;

  export let showCompletedModal: boolean;
  export let closeCompletedModal: () => void;

  export let showProcessingModal: boolean;
  export let processingSteps: Record<string, { label: string; completed: boolean; inProgress: boolean }>;

  export let showDeleteProcessingModal: boolean;
  export let deleteProcessingSteps: Record<string, { label: string; completed: boolean; inProgress: boolean }>;

  export let showCustomerBillingModal: boolean;
  export let selectedCustomer: Customer | null;

  export let showDeleteJobModal: boolean;
  export let handleDeleteJob: () => void;
</script>

  <!-- Success Modal -->
  <SuccessModal
    show={showSuccessModal}
    message={successMessage}
    orderId={generatedOrderId}
    on:close={closeSuccessModal}
  />

  <!-- Post-Submission Modal -->
  <PostSubmissionModal
    show={showPostSubmissionModal}
    message={successMessage}
    orderId={generatedOrderId}
    isPickup={action === 'Pickup'}
    on:navigateToWorkshopBoard={navigateToWorkshopBoard}
  />

  <!-- Incomplete Contact Modal -->
  {#if showIncompleteContactModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Incomplete Contact Information</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600">
            You have started entering contact information but haven't completed it yet. What would you like to do?
          </p>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg flex space-x-3">
          <button
            type="button"
            on:click={clearIncompleteContact}
            class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Clear & Continue
          </button>
          <button
            type="button"
            on:click={() => showIncompleteContactModal = false}
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Photo Viewer Modal -->
  <PhotoViewer
    {showPhotoViewer}
    {photoUrls}
    {currentPhotoIndex}
    on:close={closePhotoViewer}
    on:photoIndexChanged={({ detail }) => currentPhotoIndex = detail.index}
  />

  <!-- Pickup Submission Modal -->
  {#if showPickupSubmissionModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Pickup Job Submitted</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600">
            Your pickup job has been successfully submitted and is now ready to be quoted. The job status has been updated to "To Be Quoted".
          </p>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={navigateToWorkshopBoard}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Pickup Status Change Modal (for new pickup jobs) -->
  {#if showPickupStatusChangeModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Pickup Job Created</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            Your workshop job has been successfully created as a pickup job. The equipment is scheduled for collection and will be brought to the workshop for repair.
          </p>
          <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-blue-700">
                  <strong>Next Step:</strong> Monitor the workshop board to track when the equipment arrives and the job status updates.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closePickupStatusChangeModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Go to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Docket Ready Modal (for to_be_quoted submissions) -->
  {#if showDocketReadyModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Docket Information Saved</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            Your workshop docket information has been successfully saved and the job status has been updated to "Docket Ready".
          </p>
          <div class="bg-green-50 border border-green-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-green-700">
                  <strong>Job Status:</strong> Updated to "Docket Ready"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeDocketReadyModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Waiting Approval PO Modal (for quoted submissions) -->
  {#if showWaitingApprovalModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Waiting for PO Approval</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully moved to "Waiting Approval PO" status. The job is now awaiting purchase order approval.
          </p>
          <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-blue-700">
                  <strong>Job Status:</strong> Updated to "Waiting Approval PO"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeWaitingApprovalModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Waiting For Parts Modal (for waiting_approval_po submissions) -->
  {#if showWaitingForPartsModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Waiting For Parts</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully moved to "Waiting For Parts" status. The job is now waiting for required parts to arrive before repair work can begin.
          </p>
          <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-yellow-700">
                  <strong>Job Status:</strong> Updated to "Waiting For Parts"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeWaitingForPartsModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Booked In For Repair Modal (for waiting_for_parts submissions) -->
  {#if showBookedInRepairModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Booked In For Repair</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully booked in for repair service. The equipment is now scheduled for maintenance and repair work.
          </p>
          <div class="bg-green-50 border border-green-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-green-700">
                  <strong>Job Status:</strong> Updated to "Booked In For Repair Service"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeBookedInRepairModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Repaired Modal (for booked_in_for_repair_service submissions) -->
  {#if showRepairedModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Repair Completed</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully completed and marked as repaired. The equipment is now ready for return to the customer.
          </p>
          <div class="bg-green-50 border border-green-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-green-700">
                  <strong>Job Status:</strong> Updated to "Repaired"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeRepairedModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Return Modal (for repaired submissions) -->
  {#if showReturnModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h2a2 2 0 012 2v2H8V5z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Equipment Ready for Return</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully prepared for return to the customer. The equipment is now ready for pickup or delivery.
          </p>
          <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h2a2 2 0 012 2v2H8V5z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-blue-700">
                  <strong>Job Status:</strong> Updated to "Return"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeReturnModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Completed Modal (for return submissions) -->
  {#if showCompletedModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Job Completed</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The workshop job has been successfully completed. The equipment has been returned to the customer and the job is now closed.
          </p>
          <div class="bg-green-50 border border-green-200 rounded-md p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-green-700">
                  <strong>Job Status:</strong> Updated to "Completed"
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            on:click={closeCompletedModal}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Return to Workshop Board
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Processing Modal (for new job creation) -->
  {#if showProcessingModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-6 text-center">
          <div class="flex justify-center mb-4">
            <svg class="animate-spin h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>

          <h3 class="text-lg font-semibold text-gray-900 mb-4">Creating Your Workshop Job</h3>

          <!-- Progress Checklist -->
          <div class="space-y-3 mb-6">
            {#each Object.entries(processingSteps) as [key, step]}
              <div class="flex items-center justify-between p-3 rounded-md border {step.completed ? 'bg-green-50 border-green-200' : step.inProgress ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}">
                <div class="flex items-center">
                  <div class="flex-shrink-0 mr-3">
                    {#if step.completed}
                      <!-- Completed checkmark -->
                      <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    {:else if step.inProgress}
                      <!-- In progress spinner -->
                      <svg class="animate-spin w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    {:else}
                      <!-- Pending -->
                      <div class="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                    {/if}
                  </div>
                  <span class="text-sm font-medium {step.completed ? 'text-green-800' : step.inProgress ? 'text-blue-800' : 'text-gray-600'}">
                    {step.label}
                  </span>
                </div>
                {#if step.completed}
                  <span class="text-xs text-green-600 font-medium">✓</span>
                {/if}
              </div>
            {/each}
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <div class="flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              <p class="text-sm text-blue-700 font-medium">
                Please do not close this window or navigate away
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Processing Modal -->
  {#if showDeleteProcessingModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-6 text-center">
          <div class="flex justify-center mb-4">
            <svg class="animate-spin h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>

          <h3 class="text-lg font-semibold text-gray-900 mb-4">Deleting Workshop Job</h3>

          <!-- Progress Checklist -->
          <div class="space-y-3 mb-6">
            {#each Object.entries(deleteProcessingSteps) as [key, step]}
              <div class="flex items-center justify-between p-3 rounded-md border {step.completed ? 'bg-green-50 border-green-200' : step.inProgress ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}">
                <div class="flex items-center">
                  <div class="flex-shrink-0 mr-3">
                    {#if step.completed}
                      <!-- Completed checkmark -->
                      <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    {:else if step.inProgress}
                      <!-- In progress spinner -->
                      <svg class="animate-spin w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    {:else}
                      <!-- Pending -->
                      <div class="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                    {/if}
                  </div>
                  <span class="text-sm font-medium {step.completed ? 'text-green-800' : step.inProgress ? 'text-red-800' : 'text-gray-600'}">
                    {step.label}
                  </span>
                </div>
                {#if step.completed}
                  <span class="text-xs text-green-600 font-medium">✓</span>
                {/if}
              </div>
            {/each}
          </div>

          <div class="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <div class="flex items-center justify-center">
              <svg class="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
              <p class="text-sm text-red-700 font-medium">
                Please do not close this window or navigate away
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Customer Billing Information Modal -->
  {#if showCustomerBillingModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Customer Billing Information Required</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            The selected customer is missing required billing information (first name and last name). This information is needed to create a Maropost order.
          </p>
          <div class="bg-orange-50 border border-orange-200 rounded-md p-3 mb-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-orange-700">
                  <strong>What to do:</strong> Update the customer's billing information in Maropost with their first name and last name.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg flex space-x-3">
          <button
            type="button"
            on:click={() => showCustomerBillingModal = false}
            class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          {#if selectedCustomer}
            <a
              href="https://www.rapidsupplies.com.au/_cpanel/customer/view?id={selectedCustomer.Username}"
              target="_blank"
              on:click={() => showCustomerBillingModal = false}
              class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium text-center"
            >
              Update in Maropost
            </a>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Delete Job Confirmation Modal -->
  {#if showDeleteJobModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Delete Workshop Job</h3>
            </div>
          </div>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 mb-3">
            Are you sure you want to delete this workshop job? This action cannot be undone.
          </p>
          <div class="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-700">
                  <strong>Warning:</strong> This will permanently remove the job and all associated photos from the system.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 rounded-b-lg flex space-x-3">
          <button
            type="button"
            on:click={() => showDeleteJobModal = false}
            class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            on:click={handleDeleteJob}
            class="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Delete Job
          </button>
        </div>
      </div>
    </div>
  {/if}
