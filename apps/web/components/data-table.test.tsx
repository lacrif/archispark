import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./data-table";

vi.mock("@workspace/ui/components/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableCell: ({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) => <td colSpan={colSpan}>{children}</td>,
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  ArrowUpDown: () => <span>↕</span>,
  ChevronLeft: () => <span>←</span>,
  ChevronRight: () => <span>→</span>,
}));

interface Row { name: string; type: string; }

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "type", header: "Type" },
];

describe("DataTable", () => {
  it("renders empty state when no data", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("Aucun élément trouvé")).toBeInTheDocument();
  });

  it("renders loading state when loading and no data", () => {
    render(<DataTable columns={columns} data={[]} loading />);
    expect(screen.getByText("Chargement...")).toBeInTheDocument();
  });

  it("renders rows when data provided", () => {
    const data: Row[] = [
      { name: "App Server", type: "ApplicationComponent" },
      { name: "Database", type: "DataObject" },
    ];
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("App Server")).toBeInTheDocument();
    expect(screen.getByText("Database")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
  });

  it("shows result count", () => {
    const data: Row[] = [{ name: "A", type: "T" }];
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText(/1 résultat/)).toBeInTheDocument();
  });

  it("shows pagination controls", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText(/Page 1/)).toBeInTheDocument();
  });
});
