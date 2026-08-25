<script lang="ts">
  export let comments: Array<{ id: string; text: string; author: string; created_at: string }>;
  export let newComment: string;
  export let addComment: () => void;
</script>

<!-- Comments Section -->
<div class="grid grid-cols-1 gap-6">
  <div>
    <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-[#181b20] border border-[#262a30]">
      <h2 class="font-semibold text-white">Comments</h2>
      {#if comments.length > 0}
        <span class="text-gray-300 text-xs bg-[#1f2329] border border-[#333842] px-2.5 py-1 rounded-full font-medium">
          {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </span>
      {/if}
    </div>

    <div class="mt-4 space-y-4">
      <!-- Existing Comments -->
      {#if comments.length > 0}
        <div class="space-y-3">
          {#each comments as comment (comment.id)}
            <div class="bg-[#181b20] border border-[#262a30] rounded-xl p-4 shadow-sm">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="font-semibold text-white text-sm">{comment.author}</span>
                    <span class="text-xs text-gray-400">
                      {new Date(comment.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p class="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">{comment.text}</p>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Add New Comment -->
      <div class="bg-[#181b20] border border-[#262a30] rounded-xl p-4 shadow-sm">
        <label class="block text-sm font-medium text-gray-300 mb-2" for="new-comment">
          Add Comment
        </label>
        <div class="space-y-3">
          <textarea
            id="new-comment"
            rows="3"
            bind:value={newComment}
            class="w-full bg-[#0e1012] text-gray-200 border border-[#262a30] rounded-lg px-4 py-3 text-sm focus:border-lime-500 focus:ring-1 focus:ring-lime-500 placeholder-gray-600 transition-colors"
            placeholder="Enter your comment..."
          ></textarea>
          <div class="flex justify-end">
            <button
              type="button"
              on:click={addComment}
              disabled={!newComment.trim()}
              class="btn-primary text-sm px-4 py-2"
            >
              Add Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
