import CompanionRenderer from "../features/companion/CompanionRenderer";

export default function XiaoYanPet({ inline = false }: { inline?: boolean } = {}) {
  return <CompanionRenderer inline={inline} />;
}
