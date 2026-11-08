import MtgAuthGate from "@/components/mtg/auth/MtgAuthGate";
import MtgPlay from "@/components/mtg/play/MtgPlay";

export default function MtgPlayPage() {
  return (
    <MtgAuthGate>
      <MtgPlay />
    </MtgAuthGate>
  );
}
