import { Tomasulo, Instruction, OpCode } from "./tomasulo"; // Adjust the import if your path differs

// Initialize Tomasulo
const tomasulo = new Tomasulo();

// Set initial registers: [R0, R1, R2, R3, R4, R5, R6, R7]
tomasulo.Registers.set([0, 10, 5, 3, 2, 1, 7, 100]);
// Set initial memory
tomasulo.Memory[100] = 42;  // Address used by LOAD
tomasulo.Memory[101] = 77;  // Address used by STORE

// Add Reservation Stations with short latency for quick simulation
tomasulo.addReservationStation("ADD1", OpCode.ADD, 2);
tomasulo.addReservationStation("ADD2", OpCode.ADD, 2);
tomasulo.addReservationStation("MUL1", OpCode.MUL, 3);
tomasulo.addReservationStation("LOAD1", OpCode.LOAD, 2, 1, 1);
tomasulo.addReservationStation("STORE1", OpCode.STORE, 2, 1, 1);

// Add instructions:
// 1. LOAD R1 <- Mem[R7+0]    (R1 = 42)
// 2. ADD  R2 <- R1 + R3      (R2 = 42 + 3 = 45)
// 3. ADD  R4 <- R5 + R6      (R4 = 1 + 7 = 8)
// 4. MUL  R5 <- R2 * R4      (R5 = 45 * 8 = 360)
// 5. STORE Mem[R7+1] <- R5   (Mem[101] = 360)
tomasulo.addInstruction(new Instruction({ opcode: OpCode.LOAD, rA: 1, rB: 7, offset: 0 }), 0);
tomasulo.addInstruction(new Instruction({ opcode: OpCode.ADD, rA: 2, rB: 1, rC: 3 }), 1);
tomasulo.addInstruction(new Instruction({ opcode: OpCode.ADD, rA: 4, rB: 5, rC: 6 }), 2);
tomasulo.addInstruction(new Instruction({ opcode: OpCode.MUL, rA: 5, rB: 2, rC: 4 }), 3);
tomasulo.addInstruction(new Instruction({ opcode: OpCode.STORE, rA: 5, rB: 7, offset: 1 }), 4);

tomasulo.addStartAddress(0);

// For organized output: print Reservation Stations (RS) state
function printReservationStations(RS: any[]) {
  for (const rs of RS) {
    console.log({
      name: rs.name,
      busy: rs.busy,
      op: rs.Operation,
      vj: rs.Vj,
      vk: rs.Vk,
      qj: rs.Qj,
      qk: rs.Qk,
      result: rs.result,
      pc: rs.PC_Original,
    });
  }
}

// Run simulation for 12 cycles or until all RS are idle and all instructions written back
for (let cycle = 1; cycle <= 12; cycle++) {
  console.log(`--- Clock: ${cycle} ---`);
  console.log("Registers:", Array.from(tomasulo.Registers));
  console.log(
    `Mem[100]: ${tomasulo.Memory[100]}  Mem[101]: ${tomasulo.Memory[101]}`
  );
  printReservationStations(tomasulo.RS);
  console.log("==================================================");
  tomasulo.step();
}

