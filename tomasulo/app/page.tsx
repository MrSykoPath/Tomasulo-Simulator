"use client";

import React, { useRef, useState } from "react";
import {
  Tomasulo,
  OpCode,
  Instruction,
  ReservationStation,
} from "@/components/tomasulo";

// Helper: OpCode to String
const opcodeToString = (op: OpCode) => {
  switch (op) {
    case OpCode.LOAD:
      return "LOAD";
    case OpCode.STORE:
      return "STORE";
    case OpCode.BEQ:
      return "BEQ";
    case OpCode.CALL:
      return "CALL";
    case OpCode.RET:
      return "RET";
    case OpCode.ADD:
      return "ADD";
    case OpCode.SUB:
      return "SUB";
    case OpCode.NOR:
      return "NOR";
    case OpCode.MUL:
      return "MUL";
    default:
      return "UNK";
  }
};

export default function TomasuloSimulator() {
  // --- UI State ---
  const [instrInput, setInstrInput] = useState("");
  const [pendingInstructions, setPendingInstructions] = useState<string[]>([]);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [startAddress, setStartAddress] = useState(0);
  const [memAddrInput, setMemAddrInput] = useState("");
  const [memValInput, setMemValInput] = useState("");
  const [memoryInit, setMemoryInit] = useState<
    { addr: number; value: number }[]
  >([]);
  const [historyFilter, setHistoryFilter] = useState<number | null>(null);

  // Tomasulo engine instance
  const tomasuloRef = useRef<Tomasulo | null>(null);

  // --- ENGINE INITIALIZATION ---
  function initEngine() {
    const engine = new Tomasulo();
    // Reservation stations as per requirements
    engine.addReservationStation("Load1", OpCode.LOAD, 6, 2, 4); // 2+4
    engine.addReservationStation("Load2", OpCode.LOAD, 6, 2, 4);
    engine.addReservationStation("Store1", OpCode.STORE, 6, 2, 4);
    engine.addReservationStation("Store2", OpCode.STORE, 6, 2, 4);
    engine.addReservationStation("BEQ1", OpCode.BEQ, 1);
    engine.addReservationStation("BEQ2", OpCode.BEQ, 1);
    engine.addReservationStation("CallRet", OpCode.CALL, 1);
    engine.addReservationStation("Add1", OpCode.ADD, 2);
    engine.addReservationStation("Add2", OpCode.ADD, 2);
    engine.addReservationStation("Add3", OpCode.ADD, 2);
    engine.addReservationStation("Add4", OpCode.ADD, 2);
    engine.addReservationStation("Nor1", OpCode.NOR, 1);
    engine.addReservationStation("Nor2", OpCode.NOR, 1);
    engine.addReservationStation("Mul1", OpCode.MUL, 10);
    engine.addReservationStation("Mul2", OpCode.MUL, 10);
    // Add instructions from UI, starting at startAddress
    let addr = startAddress;
    for (const line of pendingInstructions) {
      const instr = parseInstruction(line);
      if (instr) {
        engine.addInstruction(instr, addr);
        console.log(
          `Added instruction: ${instr.getOpcode()} at address ${addr}`
        );
        addr++;
      }
    }
    // Add memory
    for (const { addr, value } of memoryInit) {
      const arr = new Uint16Array([value]);
      engine.addData(arr, addr);
    }
    engine.addStartAddress(startAddress);
    tomasuloRef.current = engine;
    setCycle(0);
  }

  // --- INSTRUCTION PARSER (UI string -> Instruction) ---
  function parseInstruction(line: string): Instruction | null {
    // Accepts: LOAD RrA, offset(RrB) | STORE RrA, offset(RrB) | BEQ RrA, RrB, offset | CALL label | RET | ADD RrA, RrB, RrC | SUB RrA, RrB, RrC | NOR RrA, RrB, RrC | MUL RrA, RrB, RrC
    const trimmed = line.trim();
    let m: RegExpMatchArray | null;
    try {
      if ((m = trimmed.match(/^LOAD R(\d+),\s*(-?\d+)\(R(\d+)\)$/i))) {
        // LOAD RrA, offset(RrB)
        return new Instruction({
          opcode: OpCode.LOAD,
          rA: +m[1],
          rB: +m[3],
          offset: +m[2],
        });
      } else if ((m = trimmed.match(/^STORE R(\d+),\s*(-?\d+)\(R(\d+)\)$/i))) {
        // STORE RrA, offset(RrB)
        return new Instruction({
          opcode: OpCode.STORE,
          rA: +m[1],
          rB: +m[3],
          offset: +m[2],
        });
      } else if ((m = trimmed.match(/^BEQ R(\d+),\s*R(\d+),\s*(-?\d+)$/i))) {
        // BEQ RrA, RrB, offset
        return new Instruction({
          opcode: OpCode.BEQ,
          rA: +m[1],
          rB: +m[2],
          offset: +m[3],
        });
      } else if ((m = trimmed.match(/^CALL (-?\d+)$/i))) {
        // CALL label
        return new Instruction({ opcode: OpCode.CALL, label: +m[1] });
      } else if (/^RET$/i.test(trimmed)) {
        return new Instruction({ opcode: OpCode.RET });
      } else if ((m = trimmed.match(/^ADD R(\d+),\s*R(\d+),\s*R(\d+)$/i))) {
        return new Instruction({
          opcode: OpCode.ADD,
          rA: +m[1],
          rB: +m[2],
          rC: +m[3],
        });
      } else if ((m = trimmed.match(/^SUB R(\d+),\s*R(\d+),\s*R(\d+)$/i))) {
        return new Instruction({
          opcode: OpCode.SUB,
          rA: +m[1],
          rB: +m[2],
          rC: +m[3],
        });
      } else if ((m = trimmed.match(/^NOR R(\d+),\s*R(\d+),\s*R(\d+)$/i))) {
        return new Instruction({
          opcode: OpCode.NOR,
          rA: +m[1],
          rB: +m[2],
          rC: +m[3],
        });
      } else if ((m = trimmed.match(/^MUL R(\d+),\s*R(\d+),\s*R(\d+)$/i))) {
        return new Instruction({
          opcode: OpCode.MUL,
          rA: +m[1],
          rB: +m[2],
          rC: +m[3],
        });
      }
    } catch {
      return null;
    }
    return null;
  }

  // --- INPUT UI LOGIC ---
  function addPendingInstruction() {
    if (instrInput.trim()) {
      setPendingInstructions((prev) => [...prev, instrInput.trim()]);
      setInstrInput("");
    }
  }
  function removeInstruction(idx: number) {
    setPendingInstructions((prev) => prev.filter((_, i) => i !== idx));
  }
  function addMemoryInit() {
    const addr = parseInt(memAddrInput);
    const value = parseInt(memValInput);
    if (!isNaN(addr) && !isNaN(value)) {
      setMemoryInit((prev) => [...prev, { addr, value }]);
      setMemAddrInput("");
      setMemValInput("");
    }
  }
  function removeMemoryInit(idx: number) {
    setMemoryInit((prev) => prev.filter((_, i) => i !== idx));
  }

  // --- SIMULATION CONTROL ---
  function startSimulation() {
    initEngine();
    setSimulationStarted(true);
    setCycle(0);
  }
  function handleNext() {
    if (tomasuloRef.current) {
      tomasuloRef.current.step();
      setCycle((c) => c + 1);
    }
  }
  function handleReset() {
    tomasuloRef.current = null;
    setSimulationStarted(false);
    setPendingInstructions([]);
    setInstrInput("");
    setCycle(0);
    setMemoryInit([]);
    setStartAddress(0);
    setHistoryFilter(null);
  }

  // --- ENGINE STATE FOR RENDERING ---
  const engine = tomasuloRef.current;
  const reservationStations = engine ? engine.RS : [];
  const registers = engine ? Array.from(engine.Registers) : [];
  const registerStatus = engine ? engine.RegisterStatus : [];
  const currentPC = engine ? engine.PC : startAddress;

  // Create a mapping of memory address -> instruction for display
  // This will reflect the current state of instructions in memory, accounting for branches/jumps
  const instructions: {
    instruction: Instruction;
    address: number;
    isPending: boolean;
    isExecuting: boolean;
  }[] = [];

  if (engine) {
    // Get all memory locations that have instructions
    // Also include addresses from the engine.Instructions array to make sure LOAD instructions are included
    const addressesFromInstructions = new Set<number>();

    // Start at the startAddress and add each instruction address
    let addr = startAddress;
    for (let i = 0; i < engine.Instructions.length; i++) {
      addressesFromInstructions.add(addr + i);
    }

    // Now get memory locations, including the ones we know have instructions
    const memoryWithInstructions = Array.from(engine.Memory)
      .map((encoded, addr) => ({ encoded, addr }))
      .filter((m) => addressesFromInstructions.has(m.addr) || m.encoded !== 0);

    // Decode each instruction and include its memory address
    for (const mem of memoryWithInstructions) {
      try {
        const instr = Instruction.decode(mem.encoded);
        if (instr) {
          // Check if this instruction is at the current PC
          const isExecuting = mem.addr === currentPC;

          // Check if this instruction is pending in a reservation station
          const isPending = engine.RS.some(
            (rs) =>
              rs.busy && rs.PC_Original !== null && rs.PC_Original === mem.addr
          );

          instructions.push({
            instruction: instr,
            address: mem.addr,
            isPending,
            isExecuting,
          });
        }
      } catch (e) {
        // Skip invalid instructions
      }
    }

    // Sort by memory address for a cleaner display
    instructions.sort((a, b) => a.address - b.address);
  }

  const memory = engine
    ? Array.from(engine.Memory)
        .map((v, i) => ({ addr: i, value: v }))
        .filter((m) => m.value !== 0)
    : [];

  // --- RENDER ---
  return (
    <main className="min-h-screen dark:bg-black bg-white py-10 flex flex-col items-center dark:text-gray-200 text-gray-800">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Tomasulo Algorithm Simulator
      </h1>

      {/* === Add Instructions UI === */}
      {!simulationStarted && (
        <div className="mb-6 flex flex-col items-center w-full max-w-xl">
          <h2 className="font-semibold text-lg mb-2">Add Instructions</h2>

          {/* Single instruction input */}
          <div className="flex gap-2 w-full mb-2">
            <input
              className="text-black dark:text-white px-2 py-1 rounded flex-1"
              type="text"
              placeholder="e.g. LOAD R0, 4(R1)"
              value={instrInput}
              onChange={(e) => setInstrInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPendingInstruction();
              }}
            />
            <button
              className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded"
              onClick={addPendingInstruction}
            >
              Add
            </button>
          </div>

          {/* Bulk instructions input */}
          <div className="w-full mt-2">
            <details className="w-full">
              <summary className="cursor-pointer font-medium text-blue-500 hover:text-blue-400">
                Add Multiple Instructions
              </summary>
              <div className="mt-2">
                <textarea
                  className="w-full h-32 px-2 py-1 text-black dark:text-white rounded"
                  placeholder="Enter multiple instructions (one per line)
e.g.
LOAD R0, 4(R1)
ADD R1, R2, R3
SUB R4, R5, R6"
                  id="multipleInstructions"
                ></textarea>
                <button
                  className="mt-2 bg-green-700 hover:bg-green-600 px-3 py-1 rounded"
                  onClick={() => {
                    const textarea = document.getElementById(
                      "multipleInstructions"
                    ) as HTMLTextAreaElement;
                    if (textarea && textarea.value) {
                      const instructions = textarea.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter((line) => line.length > 0);

                      setPendingInstructions((prev) => [
                        ...prev,
                        ...instructions,
                      ]);
                      textarea.value = "";
                    }
                  }}
                >
                  Add All
                </button>
              </div>
            </details>
          </div>

          {/* List instructions */}
          <div className="mt-4 w-full">
            {pendingInstructions.length === 0 && (
              <div className="text-gray-400 text-sm text-center">
                No instructions yet.
              </div>
            )}
            {pendingInstructions.map((line, idx) => (
              <div
                key={idx}
                className="text-gray-300 flex justify-between items-center mb-1"
              >
                <span>
                  {idx + 1}. {line}
                </span>
                <button
                  className="bg-red-700 hover:bg-red-600 px-2 py-0.5 rounded text-xs ml-2"
                  onClick={() => removeInstruction(idx)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          {/* Memory input */}
          <h2 className="font-semibold text-lg mt-6 mb-2">Initial Memory</h2>
          <div className="flex gap-2 w-full">
            <input
              className="text-black dark:text-white px-2 py-1 rounded flex-1"
              type="number"
              placeholder="Address"
              value={memAddrInput}
              onChange={(e) => setMemAddrInput(e.target.value)}
            />
            <input
              className="text-black dark:text-white px-2 py-1 rounded flex-1"
              type="number"
              placeholder="Value"
              value={memValInput}
              onChange={(e) => setMemValInput(e.target.value)}
            />
            <button
              className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded"
              onClick={addMemoryInit}
            >
              Add
            </button>
          </div>
          <div className="mt-2 w-full">
            {memoryInit.length === 0 && (
              <div className="text-gray-400 text-sm text-center">
                No memory values yet.
              </div>
            )}
            {memoryInit.map((m, idx) => (
              <div
                key={idx}
                className="text-gray-300 flex justify-between items-center mb-1"
              >
                <span>
                  Addr {m.addr}: {m.value}
                </span>
                <button
                  className="bg-red-700 hover:bg-red-600 px-2 py-0.5 rounded text-xs ml-2"
                  onClick={() => removeMemoryInit(idx)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          {/* Start address input */}
          <h2 className="font-semibold text-lg mt-6 mb-2">Start Address</h2>
          <div>
            <input
              className="text-black dark:text-white px-2 py-1 rounded w-full"
              type="number"
              placeholder="e.g. 0"
              value={startAddress}
              onChange={(e) => setStartAddress(Number(e.target.value))}
            />
            <p className="text-gray-400 text-xs mt-1">
              Instructions will be placed in memory starting at this address,
              and execution will begin here.
            </p>
          </div>
          <button
            className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-xl mt-6"
            onClick={startSimulation}
            disabled={pendingInstructions.length === 0}
          >
            Start Simulation
          </button>
        </div>
      )}

      {/* === Simulation Tables === */}
      {simulationStarted && (
        <>
          <div className="text-lg mb-4 flex gap-4 items-center">
            <span>Cycle: {cycle}</span>
            <span>PC: {currentPC}</span>
            {engine && (
              <>
                <span>
                  Branch Mispredictions: {engine.branchMispredictions}/
                  {engine.branchInstructions}
                </span>
                {engine.isBranchPending && (
                  <span className="text-yellow-500">(Branch Pending)</span>
                )}
                {engine.isJumpPending && (
                  <span className="text-yellow-500">(Jump Pending)</span>
                )}
              </>
            )}
          </div>

          {/* Instructions Table */}
          <div className="mb-8 w-full max-w-4xl">
            <h2 className="font-semibold text-lg mb-2">
              Instructions (from Memory)
            </h2>
            <div className="flex gap-2 mb-2 text-xs">
              <span className="px-2 py-0.5 bg-blue-900 rounded">
                Current PC
              </span>
              <span className="px-2 py-0.5 bg-green-900 rounded">
                In Reservation Station
              </span>
              <span className="px-2 py-0.5 bg-yellow-900 rounded">Issued</span>
              <span className="px-2 py-0.5 bg-orange-900 rounded">
                Executed
              </span>
              <span className="px-2 py-0.5 bg-red-900 rounded">
                Written Back
              </span>
            </div>
            <table className="w-full border border-gray-700 rounded-lg overflow-hidden shadow">
              <thead>
                <tr className="bg-gray-800">
                  <th className="px-2 py-1">Addr</th>
                  <th className="px-2 py-1">Opcode</th>
                  <th className="px-2 py-1">rA</th>
                  <th className="px-2 py-1">rB</th>
                  <th className="px-2 py-1">rC</th>
                  <th className="px-2 py-1">Offset</th>
                  <th className="px-2 py-1">Label</th>
                  <th className="px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {instructions.map((item, idx) => {
                  const inst = item.instruction;

                  // Get instruction status from the engine
                  const status = engine?.getInstructionStatus(item.address) || {
                    isIssued: false,
                    isExecuted: false,
                    isWrittenBack: false,
                  };

                  // Debug logging for write-back status
                  if (status.isWrittenBack) {
                    console.log(
                      `Instruction at address ${item.address} has been written back at cycle ${status.cycleWrittenBack}`
                    );
                  }

                  // Determine row background color based on execution status
                  let bgColor = "";
                  if (status.isWrittenBack) {
                    bgColor = "bg-red-900";
                  } else if (status.isExecuted) {
                    bgColor = "bg-orange-900";
                  } else if (status.isIssued) {
                    bgColor = "bg-yellow-900";
                  } else if (item.isPending) {
                    bgColor = "bg-green-900";
                  } else if (item.isExecuting) {
                    bgColor = "bg-blue-900";
                  } else {
                    bgColor = idx % 2 === 0 ? "bg-gray-800" : "bg-gray-900";
                  }

                  return (
                    <tr key={idx} className={bgColor}>
                      <td className="px-2 py-1">{item.address}</td>
                      <td className="px-2 py-1">
                        {opcodeToString(inst.getOpcode())}
                      </td>
                      <td className="px-2 py-1">{inst.getrA() ?? ""}</td>
                      <td className="px-2 py-1">{inst.getrB() ?? ""}</td>
                      <td className="px-2 py-1">{inst.getrC() ?? ""}</td>
                      <td className="px-2 py-1">{inst.getOffset() ?? ""}</td>
                      <td className="px-2 py-1">{inst.getLabel() ?? ""}</td>
                      <td className="px-2 py-1 text-xs">
                        {status.isIssued && (
                          <span className="text-yellow-300 font-medium">{`Issued:${status.cycleIssued} `}</span>
                        )}
                        {status.isExecuted && (
                          <span className="text-orange-300 font-medium">{`Executed:${status.cycleExecuted} `}</span>
                        )}
                        {status.isWrittenBack && (
                          <span className="text-red-300 font-medium">{`Written Back:${status.cycleWrittenBack}`}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Buttons */}
          <div className="flex gap-4 mt-2">
            <button
              className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-xl transition"
              onClick={handleNext}
            >
              Next Cycle
            </button>
            <button
              className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl transition"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
          {/* Reservation Stations Table */}
          <div className="mb-8 w-full max-w-5xl">
            <h2 className="font-semibold text-lg mb-2">Reservation Stations</h2>
            <table className="w-full border border-gray-700 rounded-lg overflow-hidden shadow">
              <thead>
                <tr className="bg-gray-800">
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Unit</th>
                  <th className="px-2 py-1">Busy</th>
                  <th className="px-2 py-1">Op</th>
                  <th className="px-2 py-1">Vj</th>
                  <th className="px-2 py-1">Vk</th>
                  <th className="px-2 py-1">Qj</th>
                  <th className="px-2 py-1">Qk</th>
                  <th className="px-2 py-1">Result</th>
                  <th className="px-2 py-1">A</th>
                  <th className="px-2 py-1">PC_Orig</th>
                  <th className="px-2 py-1">Cycles</th>
                  <th className="px-2 py-1">Passed</th>
                </tr>
              </thead>
              <tbody>
                {reservationStations.map((rs, idx) => (
                  <tr key={idx} className="even:bg-gray-900">
                    <td className="px-2 py-1">{rs.name}</td>
                    <td className="px-2 py-1">{opcodeToString(rs.unit)}</td>
                    <td className="px-2 py-1">{rs.busy ? "Y" : "N"}</td>
                    <td className="px-2 py-1">{rs.Operation ?? ""}</td>
                    <td className="px-2 py-1">{rs.Vj ?? ""}</td>
                    <td className="px-2 py-1">{rs.Vk ?? ""}</td>
                    <td className="px-2 py-1">{rs.Qj ?? ""}</td>
                    <td className="px-2 py-1">{rs.Qk ?? ""}</td>
                    <td className="px-2 py-1">{rs.result ?? ""}</td>
                    <td className="px-2 py-1">{rs.A ?? ""}</td>
                    <td className="px-2 py-1">{rs.PC_Original ?? ""}</td>
                    <td className="px-2 py-1">{rs.cycles_needed}</td>
                    <td className="px-2 py-1">{rs.cycles_passed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Instruction Execution History Table */}
          <div className="mb-8 w-full max-w-5xl">
            <h2 className="font-semibold text-lg mb-2">
              Instruction Execution History
            </h2>
            <div className="flex justify-between mb-2">
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-0.5 text-yellow-300 rounded">
                  Issued
                </span>
                <span className="px-2 py-0.5 text-orange-300 rounded">
                  Executed
                </span>
                <span className="px-2 py-0.5 text-red-300 rounded">
                  Written Back
                </span>
                <span className="px-2 py-0.5 text-green-300 rounded">
                  Total Latency
                </span>
                <span className="px-2 py-0.5 border-l-4 border-blue-600 pl-2 rounded">
                  Instructions in Loops
                </span>
              </div>
              {engine && engine.IssuedTracker.length > 0 && (
                <div className="flex items-center gap-2">
                  <label htmlFor="address-filter" className="text-sm">
                    Filter by Address:
                  </label>
                  <select
                    id="address-filter"
                    className="text-white bg-gray-800 px-2 py-1 rounded"
                    value={historyFilter === null ? "" : historyFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHistoryFilter(val === "" ? null : parseInt(val));
                    }}
                  >
                    <option value="">All Instructions</option>
                    {Array.from(
                      new Set(
                        engine.IssuedTracker.map(
                          (e) => e.RS.PC_Original
                        ).filter(
                          (addr): addr is number =>
                            addr !== null && addr !== undefined
                        )
                      )
                    )
                      .sort((a, b) => a - b)
                      .map((addr) => (
                        <option key={addr} value={addr}>
                          Address {addr}
                        </option>
                      ))}
                  </select>
                  <button
                    className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-sm"
                    onClick={() => setHistoryFilter(null)}
                  >
                    Clear Filter
                  </button>
                </div>
              )}
            </div>

            {/* Stats summary for instruction history */}
            {engine && engine.IssuedTracker.length > 0 && (
              <div className="bg-gray-900 p-2 rounded-t border border-gray-700 mb-0 text-sm">
                <h3 className="font-medium mb-1">
                  Instruction Pipeline Summary:
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-yellow-300 font-semibold">
                      Issued:
                    </span>{" "}
                    {engine.IssuedTracker.length} instructions
                  </div>
                  <div>
                    <span className="text-orange-300 font-semibold">
                      Executed:
                    </span>{" "}
                    {engine.ExecutedTracker.length} instructions
                  </div>
                  <div>
                    <span className="text-red-300 font-semibold">
                      Written Back:
                    </span>{" "}
                    {engine.WriteBackTracker.length} instructions
                  </div>
                </div>

                {/* Loop statistics */}
                {(() => {
                  // Get addresses that appear multiple times (in loops)
                  const addressCounts = engine.IssuedTracker.reduce(
                    (acc, entry) => {
                      const addr = entry.RS.PC_Original;
                      if (addr !== null && addr !== undefined) {
                        acc[addr] = (acc[addr] || 0) + 1;
                      }
                      return acc;
                    },
                    {} as Record<number, number>
                  );

                  const loopAddresses = Object.entries(addressCounts)
                    .filter(([_, count]) => count > 1)
                    .map(([addr]) => parseInt(addr));

                  if (loopAddresses.length > 0) {
                    return (
                      <div className="mt-1 border-t border-gray-700 pt-1">
                        <span className="font-semibold border-l-4 border-blue-600 pl-2">
                          Loop Detection:
                        </span>{" "}
                        {loopAddresses.length} instructions executed multiple
                        times
                        {historyFilter === null && loopAddresses.length > 0 && (
                          <span className="ml-2 text-gray-400">
                            (Use the filter to see individual loop iterations)
                          </span>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            <table className="w-full border border-gray-700 rounded-lg overflow-hidden shadow">
              <thead>
                <tr className="bg-gray-800">
                  <th className="px-2 py-1">Address</th>
                  <th className="px-2 py-1">Instruction</th>
                  <th className="px-2 py-1">Reservation Station</th>
                  <th className="px-2 py-1">Issued (Cycle)</th>
                  <th className="px-2 py-1">Executed (Cycle)</th>
                  <th className="px-2 py-1">Written Back (Cycle)</th>
                  <th className="px-2 py-1">Latency</th>
                </tr>
              </thead>
              <tbody>
                {engine &&
                  [...engine.IssuedTracker]
                    // Apply the address filter if one is selected
                    .filter(
                      (entry) =>
                        historyFilter === null ||
                        entry.RS.PC_Original === historyFilter
                    )
                    // Sort by address and then by issue cycle
                    .sort((a, b) => {
                      // First sort by memory address (PC_Original)
                      if (a.RS.PC_Original! !== b.RS.PC_Original!) {
                        return a.RS.PC_Original! - b.RS.PC_Original!;
                      }
                      // Then by issue cycle for instructions at the same address (handles loops)
                      return a.clock - b.clock;
                    })
                    .map((entry, idx) => {
                      // Find corresponding execution and write-back entries
                      const executeEntry = engine.ExecutedTracker.find(
                        (e) =>
                          e.RS.PC_Original === entry.RS.PC_Original &&
                          e.clock >= entry.clock
                      );
                      const writeBackEntry = engine.WriteBackTracker.find(
                        (e) =>
                          e.RS.PC_Original === entry.RS.PC_Original &&
                          e.clock >= entry.clock
                      );

                      // Format instruction details based on opcode
                      let instrText = opcodeToString(
                        entry.Instruction.getOpcode()
                      );
                      if (entry.Instruction.getOpcode() === OpCode.LOAD) {
                        instrText = `LOAD R${entry.Instruction.getrA()}, ${entry.Instruction.getOffset()}(R${entry.Instruction.getrB()})`;
                      } else if (
                        entry.Instruction.getOpcode() === OpCode.STORE
                      ) {
                        instrText = `STORE R${entry.Instruction.getrA()}, ${entry.Instruction.getOffset()}(R${entry.Instruction.getrB()})`;
                      } else if (entry.Instruction.getOpcode() === OpCode.BEQ) {
                        instrText = `BEQ R${entry.Instruction.getrA()}, R${entry.Instruction.getrB()}, ${entry.Instruction.getOffset()}`;
                      } else if (
                        entry.Instruction.getOpcode() === OpCode.CALL
                      ) {
                        instrText = `CALL ${entry.Instruction.getLabel()}`;
                      } else if (entry.Instruction.getOpcode() === OpCode.RET) {
                        instrText = `RET`;
                      } else {
                        instrText = `${instrText} R${entry.Instruction.getrA()}, R${entry.Instruction.getrB()}, R${entry.Instruction.getrC()}`;
                      }

                      // Calculate latency (time from issue to writeback)
                      const cycleIssued = entry.clock;
                      const cycleExecuted = executeEntry?.clock ?? null;
                      const cycleWrittenBack = writeBackEntry?.clock ?? null;
                      const latency =
                        cycleWrittenBack !== null
                          ? cycleWrittenBack - cycleIssued
                          : null;

                      return (
                        <tr
                          key={idx}
                          className={`${idx % 2 === 0 ? "bg-gray-900" : "bg-gray-800"} ${
                            // Highlight instructions in loops (CALL or after CALL) with a subtle indicator
                            engine.IssuedTracker.filter(
                              (e) => e.RS.PC_Original === entry.RS.PC_Original
                            ).length > 1
                              ? "border-l-4 border-blue-600"
                              : ""
                          } hover:bg-gray-700 cursor-pointer transition-colors`}
                          onClick={() => {
                            // When clicking an instruction, filter to show just that instruction address
                            setHistoryFilter(entry.RS.PC_Original);
                          }}
                          title="Click to filter by this instruction address"
                        >
                          <td className="px-2 py-1">{entry.RS.PC_Original}</td>
                          <td className="px-2 py-1">{instrText}</td>
                          <td className="px-2 py-1">{entry.RS.name}</td>
                          <td className="px-2 py-1 text-yellow-300">
                            {cycleIssued}
                          </td>
                          <td className="px-2 py-1 text-orange-300">
                            {cycleExecuted ?? "-"}
                          </td>
                          <td className="px-2 py-1 text-red-300">
                            {cycleWrittenBack ?? "-"}
                          </td>
                          <td className="px-2 py-1 text-green-300">
                            {latency !== null ? `${latency} cycles` : "-"}
                          </td>
                        </tr>
                      );
                    })}
                {(!engine || engine.IssuedTracker.length === 0) && (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-400 py-2">
                      No instructions have been issued yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Register Status */}
          <div className="mb-8 w-full max-w-3xl">
            <h2 className="font-semibold text-lg mb-2">Register Status</h2>
            <table className="w-full border border-gray-700 rounded-lg overflow-hidden shadow">
              <thead>
                <tr className="bg-gray-800">
                  {registerStatus.map((_, idx) => (
                    <th key={idx} className="px-2 py-1">
                      R{idx}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {registerStatus.map((val, idx) => (
                    <td key={idx} className="px-2 py-1 text-center">
                      {val || ""}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Registers */}
          <div className="mb-8 w-full max-w-3xl">
            <h2 className="font-semibold text-lg mb-2">Registers</h2>
            <table className="w-full border border-gray-700 rounded-lg overflow-hidden shadow">
              <thead>
                <tr className="bg-gray-800">
                  {registers.map((_, idx) => (
                    <th key={idx} className="px-2 py-1">
                      R{idx}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {registers.map((val, idx) => (
                    <td key={idx} className="px-2 py-1 text-center">
                      {val}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Memory Table */}
          <div className="mb-8 w-full max-w-3xl">
            <h2 className="font-semibold text-lg mb-2">Memory (nonzero)</h2>
            <div className="flex gap-2 mb-2 text-xs">
              <span className="px-2 py-0.5 bg-purple-900 rounded">
                Being Accessed
              </span>
            </div>
            <table className="w-full border border-gray-700 rounded-lg overflow-hidden shadow">
              <thead>
                <tr className="bg-gray-800">
                  <th className="px-2 py-1">Address</th>
                  <th className="px-2 py-1">Value</th>
                  <th className="px-2 py-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {memory.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-gray-400">
                      No memory values.
                    </td>
                  </tr>
                )}
                {memory.map((m, idx) => {
                  // Check if this memory location is being accessed by a Load/Store
                  const isBeingAccessed = engine?.RS.some(
                    (rs) =>
                      rs.busy &&
                      (rs.unit === OpCode.LOAD || rs.unit === OpCode.STORE) &&
                      rs.A === m.addr
                  );

                  return (
                    <tr
                      key={idx}
                      className={`${isBeingAccessed ? "bg-purple-900" : "even:bg-gray-900"}`}
                    >
                      <td className="px-2 py-1">{m.addr}</td>
                      <td className="px-2 py-1">{m.value}</td>
                      <td className="px-2 py-1 text-xs">
                        {isBeingAccessed ? "Being accessed" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-8 text-gray-400 text-center">
        <p>
          Built with Next.js, React, and TailwindCSS. Enter instructions,
          memory, and start address above to simulate Tomasulo’s algorithm
          interactively!
        </p>
      </div>
    </main>
  );
}
