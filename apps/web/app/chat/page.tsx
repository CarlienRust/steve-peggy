import { ChatFeature } from "@/features/chat/ChatFeature";
import { PageHeader } from "@/components/PageHeader";
import { PageSection } from "@/components/PageSection";

export default function ChatPage() {
  return (
    <>
      <PageHeader eyebrow="06 · Ask Peggy" title="Ask Peggy" description="Grounded Q&A with citations." />
      <PageSection>
        <ChatFeature />
      </PageSection>
    </>
  );
}
