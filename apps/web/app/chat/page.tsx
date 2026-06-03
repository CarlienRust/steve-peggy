import { ChatFeature } from "@/features/chat/ChatFeature";
import { PageHeader } from "@/components/PageHeader";
import { Paper } from "@mui/material";

export default function ChatPage() {
  return (
    <>
      <PageHeader
        eyebrow="03 · Ask Peggy"
        title="Ask Peggy"
        description="Grounded answers with visible citations, confidence scores, and stated limitations."
      />
      <Paper sx={{ p: 3 }}>
        <ChatFeature />
      </Paper>
    </>
  );
}
