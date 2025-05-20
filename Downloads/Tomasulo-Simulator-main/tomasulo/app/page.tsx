"use client";

import React, { useRef, useState } from "react";
import { Tomasulo, OpCode, Instruction } from "@/components/tomasulo_engine";

// Helper: OpCode to String
const opcodeToString = (op: OpCode) => {
  switch (op) {
    case OpCode.LOAD: return "LOAD";
    case OpCode.STORE: return "STORE";
    case OpCode.BEQ: return "BEQ";
    case OpCode.CALL: return "CALL";
    case OpCode.RET: return "RET";
    case OpCode.ADD: return "ADD";
    case OpCode.SUB: return "SUB";
    case OpCode.NOR: return "NOR";
    case OpCode.MUL: return "MUL";
    default: return "UNK";
  }
};

export default function TomasuloSimulator() {
  // Input state
  const [instrInput, setInstrInput] = useState("");
  const [pendingInstructions, setPendingInstructions] = useState<string[]>([]);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [cycle, setCycle] = useState(0);

  // Tomasulo engine instance
  const tomasuloRef = useRef<Tomasulo | null>(null);

  // -- ENGINE INITIALIZATION --

  function initEngine() {
    const engine = new Tomasulo();

    // Reservation stations (tweak as needed)
    engine.addReservationStation("Load1", OpCode.LOAD, 2);
    engine.addReservationStation("Load2", OpCode.LOAD, 2);
    engine.addReservationStation("Add1", OpCode.ADD, 2);
    engine.addReservationStation("Add2", OpCode.ADD, 2);
    engine.addReservationStation("Mult1", OpCode.MUL, 10);
    engine.addReservationStation("Mult2", OpCode.MUL, 10);

    // Add instructions from UI
    let addr = 0;
    for (const line of pendingInstructions) {
      const instr = parseInstruction(line);
      if (instr) {
        engine.addInstruction(instr, addr++);
      }
    }
    engine.addStartAddress(0);

    tomasuloRef.current = engine;
    setCycle(0);
  }

  // -- INSTRUCTION PARSER (UI string -> Instruction) --
  function parseInstruction(line: string): Instruction | null {
    // Example: "LOAD 0 1 32"
    const parts = line.trim().split(/\s+/);
    const opStr = parts[0]?.toUpperCase();
    let instr: Instruction | null = null;
    try {
      switch (opStr) {
        case "LOAD":
          if (parts.length === 4) instr = new Instruction({ opcode: OpCode.LOAD, rA: +parts[1], rB: +parts[2], offset: +parts[3] });
          break;
        case "STORE":
          if (parts.length === 4) instr = new Instruction({ opcode: OpCode.STORE, rA: +parts[1], rB: +parts[2], offset: +parts[3] });
          break;
        case "MUL":
          if (parts.length === 4) instr = new Instruction({ opcode: OpCode.MUL, rA: +parts[1], rB: +parts[2], rC: +parts[3] });
          break;
        case "SUB":
          if (parts.length === 4) instr = new Instruction({ opcode: OpCode.SUB, rA: +parts[1], rB: +parts[2], rC: +parts[3] });
          break;
        case "ADD":
          if (parts.length === 4) instr = new Instruction({ opcode: OpCode.ADD, rA: +parts[1], rB: +parts[2], rC: +parts[3] });
          break;
        case "NOR":
          if (parts.length === 4) instr = new Instruction({ opcode: OpCode.NOR, rA: +parts[1], rB: +parts[2], rC: +parts[3] });
          break;
        case "BEQ":
          if (parts.length === 4) instr = new Instruction({ opcode: OpCode.BEQ, rA: +parts[1], rB: +parts[2], offset: +parts[3] });
          break;
        case "CALL":
          if (parts.length === 2) instr = new Instruction({ opcode: OpCode.CALL, label: +parts[1] });
          break;
        case "RET":
          if (parts.length === 1) instr = new Instruction({ opcode: OpCode.RET });
          break;
        default:
          return null;
      }
    } catch (err) {
      // If invalid (out of range, etc), ignore
      return null;
    }
    return instr;
  }

  // -- INPUT UI LOGIC --
  function addPendingInstruction() {
    if (instrInput.trim()) {
      setPendingInstructions((prev) => [...prev, instrInput.trim()]);
      setInstrInput("");
    }
  }
  function removeInstruction(idx: number) {
    setPendingInstructions((prev) => prev.filter((_, i) => i !== idx));
  }

  // -- SIMULATION CONTROL --

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
  }

  // -- ENGINE STATE FOR RENDERING --
  const engine = tomasuloRef.current;
  const reservationStations = engine ? engine.RS : [];
  const registers = engine ? Array.from(engine.Registers) : [];
  const registerStatus = engine ? engine.RegisterStatus : [];
  const instructions = engine ? engine.Instructions : [];

  // -- RENDER --
  return (
    <main className="min-h-screen bg-black text-gray-200 py-10 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Tomasulo Algorithm Simulator
      </h1>

      {/* === Add Instructions UI === */}
      {!simulationStarted && (
        <div className="mb-6 flex flex-col items-center w-full max-w-xl">
          <h2 className="font-semibold text-lg mb-2">Add Instructions</h2>
          <div className="flex gap-2 w-full">
            <input
              className="text-black px-2 py-1 rounded flex-1"
              type="text"
              placeholder='e.g. LOAD 0 1 32'
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
          {/* List instructions */}
          <div className="mt-4 w-full">
            {pendingInstructions.length === 0 && (
              <div className="text-gray-400 text-sm text-center">No instructions yet.</div>
            )}
            {pendingInstructions.map((line, idx) => (
              <div key={idx} className="text-gray-300 flex justify-between items-center mb-1">
                <span>{idx + 1}. {line}</span>
                <button
                  className="bg-red-700 hover:bg-red-600 px-2 py-0.5 rounded text-xs ml-2"
                  onClick={() => removeInstruction(idx)}
                >
                  Remove
                </button>
              </div>
            ))}
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
          <div className="text-lg mb-4">Cycle: {cycle}</div>

          {/* Instructions Table */}
          <div className="mb-8 w-full max-w-3xl">
            <h2 className="font-semibold text-lg mb-2">Instructions</h2>
            <table className="w-full border border-gray-700 rounded-lg overflow-hidden shadow">
              <thead>
                <tr className="bg-gray-800">
                  <th className="px-2 py-1">#</th>
                  <th className="px-2 py-1">Opcode</th>
                  <th className="px-2 py-1">rA</th>
                  <th className="px-2 py-1">rB</th>
                  <th className="px-2 py-1">rC</th>
                  <th className="px-2 py-1">Offset</th>
                  <th className="px-2 py-1">Label</th>
                </tr>
              </thead>
              <tbody>
                {instructions.map((inst, idx) => (
                  <tr key={idx} className="even:bg-gray-900">
                    <td className="px-2 py-1">{idx + 1}</td>
                    <td className="px-2 py-1">{opcodeToString(inst.getOpcode())}</td>
                    <td className="px-2 py-1">{inst.getrA() ?? ""}</td>
                    <td className="px-2 py-1">{inst.getrB() ?? ""}</td>
                    <td className="px-2 py-1">{inst.getrC() ?? ""}</td>
                    <td className="px-2 py-1">{inst.getOffset() ?? ""}</td>
                    <td className="px-2 py-1">{inst.getLabel() ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reservation Stations Table */}
          <div className="mb-8 w-full max-w-4xl">
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
                  </tr>
                ))}
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
                    <th key={idx} className="px-2 py-1">R{idx}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {registerStatus.map((val, idx) => (
                    <td key={idx} className="px-2 py-1 text-center">{val || ""}</td>
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
                    <th key={idx} className="px-2 py-1">F{idx}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {registers.map((val, idx) => (
                    <td key={idx} className="px-2 py-1 text-center">{val}</td>
                  ))}
                </tr>
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
        </>
      )}

      <div className="mt-8 text-gray-400 text-center">
        <p>
          Built with Next.js, React, and TailwindCSS. Enter instructions above to simulate Tomasulo’s algorithm interactively!
        </p>
      </div>
    </main>
  );
}
