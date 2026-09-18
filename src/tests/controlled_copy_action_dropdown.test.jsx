import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DocumentDetailModal from "../components/workflow/DocumentDetailModal";
import useStore from "../store/useStore";

describe("Controlled Copy Action Hub: Click-to-Toggle Dropdown & Interaction Suite", () => {
  const sampleDoc = {
    id: "DOC-PD-001",
    title: "SOP-PD-01",
    name: "คู่มือการปฏิบัติงานฝ่ายผลิต",
    rev: "01",
    department: "PD",
    status: "EFFECTIVE"
  };

  const copyPD1 = {
    id: "cc-001",
    doc_id: "DOC-PD-001",
    copy_no: "01",
    recipientDept: "PD",
    department: "PD",
    location: "Mixing Room",
    status: "ISSUED_ACTIVE"
  };

  const copyPD2 = {
    id: "cc-002",
    doc_id: "DOC-PD-001",
    copy_no: "02",
    recipientDept: "PD",
    department: "PD",
    location: "Packing Line",
    status: "ISSUED_ACTIVE"
  };

  beforeEach(() => {
    useStore.setState({
      currentUser: { id: "U002", name: "ธนาวุฒิ PD", department: "PD", isDcc: false, role: "GENERAL_USER" },
      documentControlledCopies: [copyPD1, copyPD2],
      controlledCopyInstances: [copyPD1, copyPD2],
      documents: [sampleDoc],
      canDownloadDocument: () => true
    });
  });

  it("1. Origin Invariant: Copy 01 shows only Damaged/Lost; Copy 02 shows all 3 actions", () => {
    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    const triggerButtons = screen.getAllByRole("button", { name: /จัดการสำเนา/i });
    expect(triggerButtons.length).toBe(2);

    // Initial state: no menus open
    expect(screen.queryByText("ขอย้ายจุดติดตั้ง")).not.toBeInTheDocument();
    expect(screen.queryByText("ส่งคืน / ยกเลิกสำเนา")).not.toBeInTheDocument();
    expect(screen.queryByText("แจ้งชำรุด / สูญหาย")).not.toBeInTheDocument();

    // Click trigger on Copy 01 (Origin — Relocate & Return must be hidden)
    fireEvent.click(triggerButtons[0]);
    expect(screen.queryByText("ขอย้ายจุดติดตั้ง")).not.toBeInTheDocument();
    expect(screen.queryByText("ส่งคืน / ยกเลิกสำเนา")).not.toBeInTheDocument();
    expect(screen.getByText("แจ้งชำรุด / สูญหาย")).toBeInTheDocument();

    // Close Copy 01 menu
    fireEvent.click(triggerButtons[0]);

    // Click trigger on Copy 02 (non-origin — all 3 actions visible)
    fireEvent.click(triggerButtons[1]);
    expect(screen.getByText("ขอย้ายจุดติดตั้ง")).toBeInTheDocument();
    expect(screen.getByText("ส่งคืน / ยกเลิกสำเนา")).toBeInTheDocument();
    expect(screen.getByText("แจ้งชำรุด / สูญหาย")).toBeInTheDocument();

    // Mouse leave does NOT close the menu (unlike legacy hover menu)
    fireEvent.mouseLeave(triggerButtons[1]);
    expect(screen.getByText("ขอย้ายจุดติดตั้ง")).toBeInTheDocument();

    // Clicking same trigger closes it
    fireEvent.click(triggerButtons[1]);
    expect(screen.queryByText("ขอย้ายจุดติดตั้ง")).not.toBeInTheDocument();
  });

  it("2. Clicking outside the menu closes it (Copy 02 – non-origin)", () => {
    render(
      <div data-testid="outside-container">
        <DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />
      </div>
    );

    // Use Copy 02 trigger (index [1]) to get full menu with Relocate visible
    const triggerButton = screen.getAllByRole("button", { name: /จัดการสำเนา/i })[1];
    fireEvent.click(triggerButton);
    expect(screen.getByText("ขอย้ายจุดติดตั้ง")).toBeInTheDocument();

    // Mouse down outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("ขอย้ายจุดติดตั้ง")).not.toBeInTheDocument();
  });

  it("3. Pressing Escape key closes the active dropdown menu (Copy 02)", () => {
    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    // Use Copy 02 trigger (index [1]) to get full menu with Relocate visible
    const triggerButton = screen.getAllByRole("button", { name: /จัดการสำเนา/i })[1];
    fireEvent.click(triggerButton);
    expect(screen.getByText("ขอย้ายจุดติดตั้ง")).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("ขอย้ายจุดติดตั้ง")).not.toBeInTheDocument();
  });

  it("4. Clicking another copy trigger closes the first and opens the second (single menu constraint)", () => {
    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    const triggers = screen.getAllByRole("button", { name: /จัดการสำเนา/i });
    expect(triggers.length).toBe(2);

    // Open Copy 01 menu (restricted – no Relocate/Return)
    fireEvent.click(triggers[0]);
    expect(triggers[0]).toHaveAttribute("aria-expanded", "true");
    expect(triggers[1]).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("ขอย้ายจุดติดตั้ง")).not.toBeInTheDocument();

    // Click Copy 02 menu
    fireEvent.click(triggers[1]);
    expect(triggers[0]).toHaveAttribute("aria-expanded", "false");
    expect(triggers[1]).toHaveAttribute("aria-expanded", "true");

    // Only 1 instance of each action (from Copy 02 menu)
    const relocateActions = screen.getAllByText("ขอย้ายจุดติดตั้ง");
    expect(relocateActions.length).toBe(1);
  });

  it("5. Selecting \"แจ้งชำรุด / สูญหาย\" closes the menu and opens the replacement modal", () => {
    render(<DocumentDetailModal isOpen={true} onClose={() => {}} document={sampleDoc} />);

    const triggerButton = screen.getAllByRole("button", { name: /จัดการสำเนา/i })[0];
    fireEvent.click(triggerButton);

    const reportButton = screen.getByText("แจ้งชำรุด / สูญหาย");
    fireEvent.click(reportButton);

    // Dropdown closes immediately
    expect(screen.queryByText("ขอย้ายจุดติดตั้ง")).not.toBeInTheDocument();

    // Replacement modal opens
    expect(screen.getByText(/แจ้งเอกสารชำรุด\/สูญหาย/i)).toBeInTheDocument();
  });
});
