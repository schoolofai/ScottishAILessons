import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ActionBarPrimitive,
  BranchPickerPrimitive,
  useMessage,
  useThread,
  // TODO: this template is on an older version of @assistant-ui/react, this should be updated
  // ErrorPrimitive,
} from "@assistant-ui/react";
import type { FC } from "react";
import { useRef, useEffect, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  CopyIcon,
  CheckIcon,
  PencilIcon,
  RefreshCwIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Square,
} from "lucide-react";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MarkdownText } from "./markdown-text";
import { UserMessageText } from "./user-message-text";
import { ToolFallback } from "./tool-fallback";
import { useSessionContext } from "@/lib/SessionContext";
import { useReplayMode } from "@/contexts/ReplayModeContext";

// Component to handle scroll and glow when streaming completes
const StreamCompleteHandler: FC = () => {
  const isRunning = useThread((t) => t.isRunning);
  const wasRunningRef = useRef(false);

  useEffect(() => {
    // Track when thread starts running
    if (isRunning) {
      wasRunningRef.current = true;
    }

    // When streaming completes (was running, now not running)
    if (wasRunningRef.current && !isRunning) {
      wasRunningRef.current = false;

      // Helper function to scroll to the top of the last assistant message
      const scrollToMessageTop = () => {
        const assistantMessages = document.querySelectorAll('[data-role="assistant"]');
        const lastMessage = assistantMessages[assistantMessages.length - 1] as HTMLElement;

        if (lastMessage) {
          // Find the scroll container (ThreadPrimitive.Viewport with overflow-y-auto)
          const viewport = lastMessage.closest('.overflow-y-auto') as HTMLElement;

          if (viewport) {
            // Calculate the absolute position of the message within the scroll container
            const messageRect = lastMessage.getBoundingClientRect();
            const viewportRect = viewport.getBoundingClientRect();
            const targetScrollTop = messageRect.top - viewportRect.top + viewport.scrollTop;
            const viewportPadding = 16;

            // Use instant scroll to override any auto-scroll
            viewport.scrollTop = Math.max(0, targetScrollTop - viewportPadding);
          }

          return lastMessage;
        }
        return null;
      };

      // First scroll attempt after initial render
      setTimeout(() => {
        const lastMessage = scrollToMessageTop();

        if (lastMessage) {
          // Add glow animation
          lastMessage.classList.add('animate-message-glow');
          setTimeout(() => {
            lastMessage.classList.remove('animate-message-glow');
          }, 1500);
        }
      }, 300);

      // Second scroll attempt after components settle (images load, inputs focus)
      setTimeout(() => {
        scrollToMessageTop();
      }, 800);

      // Third scroll attempt as final override
      setTimeout(() => {
        scrollToMessageTop();
      }, 1200);
    }
  }, [isRunning]);

  return null;
};

export const Thread: FC = () => {
  const { isSessionMode } = useSessionContext();
  const { isReplayMode } = useReplayMode();

  return (
    <ThreadPrimitive.Root
      // aui-thread-root
      className="bg-background flex h-full flex-col"
      style={{
        ["--thread-max-width" as string]: "48rem",
        ["--thread-padding-x" as string]: "1rem",
      }}
    >
      {/* Handler for scroll and glow on stream complete */}
      {/* TEMPORARILY DISABLED - investigating message disappearing bug */}
      {/* <StreamCompleteHandler /> */}

      {/* aui-thread-viewport */}
      <ThreadPrimitive.Viewport className="relative flex min-w-0 flex-1 min-h-0 flex-col gap-6 overflow-y-auto px-[var(--thread-padding-x)] py-4">
        <ThreadWelcome />

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            EditComposer,
            AssistantMessage,
          }}
        />

        <ThreadPrimitive.If empty={false}>
          {/* aui-thread-viewport-spacer */}
          <div className="min-h-8 shrink-0" />
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>

      {!isSessionMode && !isReplayMode && (
        <div className="shrink-0 bg-background border-t border-gray-200 pb-12">
          <Composer />
        </div>
      )}

      {isSessionMode && !isReplayMode && (
        <div className="shrink-0 bg-background border-t border-gray-200 p-4">
          <div className="text-center text-sm text-muted-foreground">
            📚 Interact with the lesson cards above to continue your learning journey
          </div>
        </div>
      )}

      {isReplayMode && (
        <div className="shrink-0 bg-background border-t border-gray-200 p-4">
          <div className="text-center text-sm text-muted-foreground italic">
            🎬 Replay Mode - This is a read-only view of a completed lesson session
          </div>
        </div>
      )}
    </ThreadPrimitive.Root>
  );
};


const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        // aui-thread-scroll-to-bottom
        className="dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <ThreadPrimitive.Empty>
      {/* aui-thread-welcome-root */}
      <div className="flex w-full flex-grow flex-col items-center justify-center min-h-[50vh]">
        {/* aui-thread-welcome-message */}
        <div className="flex flex-col justify-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.5 }}
            // aui-thread-welcome-message-motion-1
            className="text-2xl font-semibold"
          >
            Hello there!
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.6 }}
            // aui-thread-welcome-message-motion-2
            className="text-muted-foreground/65 text-2xl"
          >
            How can I help you today?
          </motion.div>
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
};

const ThreadWelcomeSuggestions: FC = () => {
  return (
    // aui-thread-welcome-suggestions
    <div className="grid w-full gap-2 sm:grid-cols-2">
      {[
        {
          title: "What are the advantages",
          label: "of using Assistant Cloud?",
          action: "What are the advantages of using Assistant Cloud?",
        },
        {
          title: "Write code to",
          label: `demonstrate topological sorting`,
          action: `Write code to demonstrate topological sorting`,
        },
        {
          title: "Help me write an essay",
          label: `about AI chat applications`,
          action: `Help me write an essay about AI chat applications`,
        },
        {
          title: "What is the weather",
          label: "in San Francisco?",
          action: "What is the weather in San Francisco?",
        },
      ].map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          // aui-thread-welcome-suggestion-display
          className="[&:nth-child(n+3)]:hidden sm:[&:nth-child(n+3)]:block"
        >
          <ThreadPrimitive.Suggestion
            prompt={suggestedAction.action}
            method="replace"
            autoSend
            asChild
          >
            <Button
              variant="ghost"
              // aui-thread-welcome-suggestion
              className="dark:hover:bg-accent/60 h-auto w-full flex-1 flex-wrap items-start justify-start gap-1 rounded-xl border px-4 py-3.5 text-left text-sm sm:flex-col"
              aria-label={suggestedAction.action}
            >
              {/* aui-thread-welcome-suggestion-text-1 */}
              <span className="font-medium">{suggestedAction.title}</span>
              {/* aui-thread-welcome-suggestion-text-2 */}
              <p className="text-muted-foreground">{suggestedAction.label}</p>
            </Button>
          </ThreadPrimitive.Suggestion>
        </motion.div>
      ))}
    </div>
  );
};

const Composer: FC = () => {
  return (
    // aui-composer-wrapper
    <div className="bg-background relative mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 px-[var(--thread-padding-x)] py-4">
      <ThreadScrollToBottom />
      {/* Removed ThreadWelcomeSuggestions to save space */}
      {/* aui-composer-root */}
      <ComposerPrimitive.Root className="focus-within:ring-offset-2 relative flex w-full flex-col rounded-2xl focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white">
        {/* aui-composer-input */}
        <ComposerPrimitive.Input
          placeholder="Send a message..."
          className={
            "bg-muted border-border dark:border-muted-foreground/15 focus:outline-primary placeholder:text-muted-foreground max-h-[calc(50dvh)] min-h-16 w-full resize-none rounded-t-2xl border-x border-t px-4 pt-2 pb-3 text-base outline-none"
          }
          rows={1}
          autoFocus
          aria-label="Message input"
          data-testid="chat-input"
        />
        <ComposerAction />
      </ComposerPrimitive.Root>
    </div>
  );
};

const ComposerAction: FC = () => {
  return (
    // aui-composer-action-wrapper
    <div className="bg-muted border-border dark:border-muted-foreground/15 relative flex items-center justify-between rounded-b-2xl border-x border-b p-2">
      <TooltipIconButton
        tooltip="Attach file"
        variant="ghost"
        // aui-composer-attachment-button
        className="hover:bg-foreground/15 dark:hover:bg-background/50 scale-115 p-3.5"
        onClick={() => {
          console.log("Attachment clicked - not implemented");
        }}
      >
        <PlusIcon />
      </TooltipIconButton>

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <Button
            type="submit"
            variant="default"
            // aui-composer-send
            className="dark:border-muted-foreground/90 border-muted-foreground/60 hover:bg-primary/75 size-8 rounded-full border"
            aria-label="Send message"
            data-testid="chat-send"
          >
            {/* aui-composer-send-icon */}
            <ArrowUpIcon className="size-5" />
          </Button>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            // aui-composer-cancel
            className="dark:border-muted-foreground/90 border-muted-foreground/60 hover:bg-primary/75 size-8 rounded-full border"
            aria-label="Stop generating"
          >
            {/* aui-composer-cancel-icon */}
            <Square className="size-3.5 fill-white dark:size-4 dark:fill-black" />
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </div>
  );
};

// TODO: this template is on an older version of @assistant-ui/react, this should be updated
// const MessageError: FC = () => {
//   return (
//     <MessagePrimitive.Error>
//       {/* aui-message-error-root */}
//       <ErrorPrimitive.Root className="border-destructive bg-destructive/10 dark:bg-destructive/5 text-destructive mt-2 rounded-md border p-3 text-sm dark:text-red-200">
//         {/* aui-message-error-message */}
//         <ErrorPrimitive.Message className="line-clamp-2" />
//       </ErrorPrimitive.Root>
//     </MessagePrimitive.Error>
//   );
// };

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <motion.div
        // aui-assistant-message-root
        className="relative mx-auto grid w-full max-w-[var(--thread-max-width)] grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] py-4 px-3 scroll-mt-4 rounded-lg transition-colors"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role="assistant"
        data-testid="ai-message"
      >
        {/* aui-assistant-message-avatar */}
        <div className="ring-border bg-background col-start-1 row-start-1 flex size-8 shrink-0 items-center justify-center rounded-full ring-1">
          <StarIcon size={14} />
        </div>

        {/* aui-assistant-message-content */}
        <div className="text-foreground col-span-2 col-start-2 row-start-1 ml-4 leading-7 break-words">
          <MessagePrimitive.Content
            components={{
              Text: MarkdownText,
              tools: { Fallback: ToolFallback },
            }}
          />
          {/* TODO: this template is on an older version of @assistant-ui/react, this should be updated */}
          {/* <MessageError /> */}
        </div>

        <AssistantActionBar />

        {/* aui-assistant-branch-picker */}
        <BranchPicker className="col-start-2 row-start-2 mr-2 -ml-2" />
      </motion.div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      // aui-assistant-action-bar-root
      className="text-muted-foreground data-floating:bg-background col-start-3 row-start-2 mt-3 ml-3 flex gap-1 data-floating:absolute data-floating:mt-2 data-floating:rounded-md data-floating:border data-floating:p-1 data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <motion.div
        // aui-user-message-root
        className="mx-auto grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-1 py-4 [&:where(>*)]:col-start-2"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role="user"
      >
        <UserActionBar />

        {/* aui-user-message-content */}
        <div className="bg-muted text-foreground col-start-2 rounded-3xl px-5 py-2.5 break-words">
          <MessagePrimitive.Content components={{ Text: UserMessageText }} />
        </div>

        {/* aui-user-branch-picker */}
        <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
      </motion.div>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      // aui-user-action-bar-root
      className="col-start-1 mt-2.5 mr-3 flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    // aui-edit-composer-wrapper
    <div className="mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4">
      {/* aui-edit-composer-root */}
      <ComposerPrimitive.Root className="bg-muted ml-auto flex w-full max-w-[87.5%] flex-col rounded-xl">
        {/* aui-edit-composer-input */}
        <ComposerPrimitive.Input
          className="text-foreground flex min-h-[60px] w-full resize-none bg-transparent p-4 outline-none"
          autoFocus
        />

        {/* aui-edit-composer-footer */}
        <div className="mx-3 mb-3 flex items-center justify-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm" aria-label="Cancel edit">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" aria-label="Update message">
              Update
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      // aui-branch-picker-root
      className={cn(
        "text-muted-foreground inline-flex items-center text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      {/* aui-branch-picker-state */}
      <span className="font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};

const StarIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 0L9.79611 6.20389L16 8L9.79611 9.79611L8 16L6.20389 9.79611L0 8L6.20389 6.20389L8 0Z"
      fill="currentColor"
    />
  </svg>
);
