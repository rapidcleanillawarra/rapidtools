<script lang="ts">
  export let comments: Array<{ id: string; text: string; author: string; created_at: string }>;
  export let newComment: string;
  export let addComment: () => void;
</script>

      <!-- Comments Section -->
      <div class="grid grid-cols-1 gap-6">
        <div>
          <div
            class="flex items-center justify-between px-4 py-3 rounded"
            style="background-color: rgb(30, 30, 30);"
          >
            <h2 class="font-medium text-white">Comments</h2>
            {#if comments.length > 0}
              <span class="text-white text-sm bg-gray-600 px-2 py-1 rounded-full">
                {comments.length} comment{comments.length !== 1 ? 's' : ''}
              </span>
            {/if}
          </div>

          <div class="mt-4 space-y-4">
            <!-- Existing Comments -->
            {#if comments.length > 0}
              <div class="space-y-3">
                {#each comments as comment (comment.id)}
                  <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="font-medium text-gray-900">{comment.author}</span>
                          <span class="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p class="text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Add New Comment -->
            <div class="bg-white border border-gray-300 rounded-lg p-4">
              <label class="block text-sm font-medium text-gray-700 mb-2" for="new-comment">
                Add Comment
              </label>
              <div class="space-y-3">
                <textarea
                  id="new-comment"
                  rows="3"
                  bind:value={newComment}
                  class="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your comment..."
                ></textarea>
                <div class="flex justify-end">
                  <button
                    type="button"
                    on:click={addComment}
                    disabled={!newComment.trim()}
                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-colors"
                  >
                    Add Comment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
