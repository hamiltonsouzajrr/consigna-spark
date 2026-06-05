import { createFileRoute } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { organograma, type OrgNode } from "@/lib/rh/extra";

export const Route = createFileRoute("/rh/organograma")({
  component: Organograma,
});

function NodeCard({ node }: { node: OrgNode }) {
  return (
    <Card className="flex w-52 flex-col items-center gap-2 p-3 text-center shadow-sm">
      <Avatar className="h-12 w-12">
        <AvatarImage src={node.foto} alt={node.nome} />
        <AvatarFallback>{node.nome.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-semibold leading-tight">{node.nome}</p>
        <p className="text-xs text-muted-foreground">{node.cargo}</p>
      </div>
      <Badge variant="outline" className="text-[10px]">{node.departamento}</Badge>
    </Card>
  );
}

function Tree({ node }: { node: OrgNode }) {
  const children = node.filhos ?? [];
  return (
    <li className="relative">
      <div className="flex justify-center">
        <NodeCard node={node} />
      </div>
      {children.length > 0 && (
        <ul className="org-children mt-6 flex justify-center gap-6">
          {children.map((c) => <Tree key={c.id} node={c} />)}
        </ul>
      )}
    </li>
  );
}

function Organograma() {
  return (
    <div>
      <RhPageHeader title="Organograma Visual" description="Hierarquia, gestores e subordinados da empresa." />
      <Card className="overflow-x-auto p-8">
        <style>{`
          .org-tree, .org-children { list-style: none; padding: 0; margin: 0; }
          .org-tree { display: flex; justify-content: center; }
          .org-children > li { padding-top: 1.75rem; }
          .org-children > li::before {
            content: ""; position: absolute; top: 0; left: 50%;
            height: 1.75rem; border-left: 2px solid var(--border);
          }
          .org-children::before {
            content: ""; display: block; height: 0;
          }
          .org-children > li::after {
            content: ""; position: absolute; top: 0; left: 0; right: 0;
            border-top: 2px solid var(--border);
          }
          .org-children > li:first-child::after { left: 50%; }
          .org-children > li:last-child::after { right: 50%; }
          .org-children > li:only-child::after { display: none; }
        `}</style>
        <ul className="org-tree min-w-max">
          <Tree node={organograma} />
        </ul>
      </Card>
    </div>
  );
}
