import { useParams, useNavigate } from "react-router-dom";
import { TicketChatView } from "@/modules/support/components/TicketChatView";

export default function AgencyTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  if (!ticketId) return null;

  return (
    <div className="w-full h-full p-4">
      <TicketChatView 
        ticketId={ticketId} 
        onBack={() => navigate("/agency/support")} 
      />
    </div>
  );
}
