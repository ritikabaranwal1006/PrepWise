"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
}: AgentProps) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    const onCallStart = () => {
      setCallStatus(CallStatus.ACTIVE);
    };

    const onCallEnd = () => {
      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: any) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [...prev, newMessage]);
      }
    };

    const onSpeechStart = () => {
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      setIsSpeaking(false);
    };

    const onError = (error: any) => {
      setFatalError(
        error?.message || "An error occurred with the AI Interviewer. Please try again or contact support."
      );
      console.error("Vapi Error:", error);
    };

    // Ensure single instance and prevent duplicate listeners
    vapi.removeAllListeners();
    
    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }

    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      try {
        const { success, feedbackId: id } = await createFeedback({
          interviewId: interviewId!,
          userId: userId!,
          transcript: messages,
          feedbackId,
        });

        if (success && id) {
          router.push(`/interview/${interviewId}/feedback`);
        } else {
          setFatalError("Error saving feedback. Redirecting to home.");
          router.push("/");
        }
      } catch (err) {
        setFatalError("Unexpected error saving feedback.");
        router.push("/");
      }
    };

    if (callStatus === CallStatus.FINISHED) {
      if (type === "generate") {
        router.push("/");
      } else {
        handleGenerateFeedback(messages);
      }
    }
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId]);

  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);

    if (type === "generate") {
      const workflowId = process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID;
      const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
      if (!workflowId) {
        setFatalError("Interview workflow is not configured. Please contact support.");
        setCallStatus(CallStatus.INACTIVE);
        return;
      }
      if (!assistantId) {
        setFatalError("Assistant is not configured. Please contact support.");
        setCallStatus(CallStatus.INACTIVE);
        return;
      }
      if (!userName || !userId) {
        setFatalError("User information missing. Please login again.");
        setCallStatus(CallStatus.INACTIVE);
        return;
      }
      try {
        // Pass assistantId as the 1st argument, workflowId as the 4th argument
        await vapi.start(
          assistantId,
          undefined,
          undefined,
          workflowId,
          {
            variableValues: {
              username: userName,
              userid: userId,
            },
          }
        );
      } catch (err) {
        console.error("Error calling vapi.start (generate):", err);
        setFatalError("Failed to start interview. Please check your internet connection or contact support.");
        setCallStatus(CallStatus.INACTIVE);
      }
    } else {
      if (!interviewer) {
        setFatalError("No interviewer configured. Please contact support.");
        setCallStatus(CallStatus.INACTIVE);
        return;
      }
      let formattedQuestions = "";
      if (questions) {
        formattedQuestions = questions
          .map((question) => `- ${question}`)
          .join("\n");
      }
      try {
        await vapi.start(interviewer, {
          variableValues: {
            questions: formattedQuestions,
          },
        });
      } catch (err) {
        console.error("Error calling vapi.start (interviewer):", err);
        setFatalError("Failed to start interview. Please check your internet connection or contact support.");
        setCallStatus(CallStatus.INACTIVE);
      }
    }
  };

  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    vapi.stop();
  };

  // === ERROR UI ===
  if (fatalError) {
    return (
      <div className="call-view error">
        <h2 className="text-red-500 text-xl mb-4">Error</h2>
        <p>{fatalError}</p>
        <button className="btn-primary mt-6" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="call-view">
        {/* AI Interviewer Card */}
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="profile-image"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        {/* User Profile Card */}
        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="profile-image"
              width={539}
              height={539}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              key={lastMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus !== "ACTIVE" ? (
          <button className="relative btn-call" onClick={() => handleCall()}>
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== "CONNECTING" && "hidden"
              )}
            />

            <span className="relative">
              {callStatus === "INACTIVE" || callStatus === "FINISHED"
                ? "Call"
                : ". . ."}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={() => handleDisconnect()}>
            End
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;