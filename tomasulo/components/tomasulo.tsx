enum OpCode {
  LOAD,
  STORE,
  BEQ,
  CALL,
  RET,
  ADD,
  SUB,
  NOR,
  MUL,
}

class Instruction {
  private opcode: OpCode = OpCode.ADD;
  private rA?: number;
  private rB?: number;
  private rC?: number;
  private offset?: number;
  private label?: number;

  constructor(init?: {
    opcode?: OpCode;
    rA?: number;
    rB?: number;
    rC?: number;
    offset?: number;
    label?: number;
  }) {
    if (init?.opcode !== undefined) this.setOpcode(init.opcode);
    if (init?.rA !== undefined) this.setrA(init.rA);
    if (init?.rB !== undefined) this.setrB(init.rB);
    if (init?.rC !== undefined) this.setrC(init.rC);
    if (init?.offset !== undefined) this.setOffset(init.offset);
    if (init?.label !== undefined) this.setLabel(init.label);
  }

  setOpcode(opcode: OpCode) {
    this.opcode = opcode;
  }

  setrA(rA: number) {
    this.validateRegister(rA);
    this.rA = rA;
  }

  setrB(rB: number) {
    this.validateRegister(rB);
    this.rB = rB;
  }

  setrC(rC: number) {
    this.validateRegister(rC);
    this.rC = rC;
  }

  setOffset(value: number) {
    if (value < -16 || value > 15) {
      throw new Error("Offset must be a 5-bit signed value (-16 to 15)");
    }
    this.offset = value;
  }

  setLabel(label: number) {
    if (label < -64 || label > 63) {
      throw new Error("Label must be a 7-bit signed value (-64 to 63)");
    }
    this.label = label;
  }

  encode(): number {
    let value = 0;
    value |= (this.opcode & 0xf) << 12;
    if (this.opcode === OpCode.CALL) {
      // CALL: [opcode(4)][label(7)][unused(5)]
      let label = this.label ?? 0;
      if (label < 0) label = (label + 128) & 0x7f;
      value |= label & 0x7f;
    } else if (
      this.opcode === OpCode.LOAD ||
      this.opcode === OpCode.STORE ||
      this.opcode === OpCode.BEQ
    ) {
      // [opcode(4)][rA(3)][rB(3)][offset(5)]
      value |= ((this.rA ?? 0) & 0x7) << 9;
      value |= ((this.rB ?? 0) & 0x7) << 6;
      let offset = this.offset ?? 0;
      if (offset < 0) offset = (offset + 32) & 0x1f; // 5-bit signed
      value |= offset & 0x1f;
    } else {
      // [opcode(4)][rA(3)][rB(3)][rC(3)][unused(3)]
      value |= ((this.rA ?? 0) & 0x7) << 9;
      value |= ((this.rB ?? 0) & 0x7) << 6;
      value |= ((this.rC ?? 0) & 0x7) << 3;
    }
    return value & 0xffff;
  }

  static decode(encoded: number): Instruction {
    const opcode = (encoded >> 12) & 0xf;
    if (opcode === OpCode.CALL) {
      let label = encoded & 0x7f;
      if (label & 0x40) label = label | 0xffffff80;
      return new Instruction({ opcode, label });
    } else if (
      opcode === OpCode.LOAD ||
      opcode === OpCode.STORE ||
      opcode === OpCode.BEQ
    ) {
      const rA = (encoded >> 9) & 0x7;
      const rB = (encoded >> 6) & 0x7;
      let offset = encoded & 0x1f;
      if (offset & 0x10) offset = offset | 0xffffffe0; // sign-extend 5 bits
      return new Instruction({ opcode, rA, rB, offset });
    } else {
      const rA = (encoded >> 9) & 0x7;
      const rB = (encoded >> 6) & 0x7;
      const rC = (encoded >> 3) & 0x7;
      return new Instruction({ opcode, rA, rB, rC });
    }
  }

  getOpcode() {
    return this.opcode;
  }
  getrA() {
    return this.rA;
  }
  getrB() {
    return this.rB;
  }
  getrC() {
    return this.rC;
  }
  getOffset() {
    return this.offset;
  }
  getLabel() {
    return this.label;
  }

  private validateRegister(reg: number) {
    if (reg < 0 || reg > 7) {
      throw new Error("Invalid register number (must be 0-7)");
    }
  }

  clone(): Instruction {
    return new Instruction({
      opcode: this.opcode,
      rA: this.rA,
      rB: this.rB,
      rC: this.rC,
      offset: this.offset,
      label: this.label,
    });
  }
}

class ReservationStation {
  name: string;
  unit: OpCode;
  busy: boolean = false;
  Operation: string | null = null; // Operation to be performed
  Vj: number | null = null;
  Vk: number | null = null;
  Qj: string | null = null; // Tag of RS producing Vj
  Qk: string | null = null; // Tag of RS producing Vk
  instruction: Instruction | null = null; // Address to store instruction
  result: number | null = null; // Result of the operation
  PC_Original: number | null = null; // Original PC of the instruction
  A: number | null = null; // For memory instructions
  cycles_needed: number = 0; // Number of cycles needed for the operation
  cycles_passed: number = 0; // Number of cycles passed since the instruction was issued
  cycles_needed_to_compute_address: number | null = null; // Number of cycles needed to compute the address
  cycles_needed_to_read_write_from_memory: number | null = null; // Number of cycles needed to read/write from memory

  constructor(name: string, unit: OpCode, cycles_needed: number) {
    this.name = name;
    this.unit = unit;
    this.cycles_needed = cycles_needed;
  }
}

class Tomasulo {
  Memory: Uint16Array;
  Registers: Uint16Array;
  Instructions: Instruction[];
  RS: ReservationStation[];
  CDB: number | null = null;
  RegisterStatus = new Array(8).fill(0); // Track which RS is writing to each register
  PC: number = 0; // Program Counter
  IssuedTracker: {
    Instruction: Instruction;
    clock: number;
    RS: ReservationStation;
  }[] = []; // Track issued instructions
  ExecutedTracker: {
    Instruction: Instruction;
    clock: number;
    RS: ReservationStation;
  }[] = []; // Track executed instructions
  WriteBackTracker: {
    Instruction: Instruction;
    clock: number;
    RS: ReservationStation;
  }[] = []; // Track instructions that have written back
  clock: number = 0; // Clock cycles
  isBranchPending: boolean = false; // Flag to indicate if a branch is pending
  branchMispredictions: number = 0;
  branchInstructions: number = 0;
  IssuedAfterBranch: number = 0;
  isJumpPending: boolean = false; // Flag to indicate if a jump is pending

  constructor() {
    this.Memory = new Uint16Array(65536);
    this.Registers = new Uint16Array(8);
    this.Instructions = [];
    this.RS = [];
  }

  addInstruction(instruction: Instruction, address: number) {
    if (address < 0 || address >= this.Memory.length) {
      throw new Error("Starting address out of bounds");
    }
    this.Instructions.push(instruction);
    this.Memory[address] = instruction.encode();
  }

  addInstructions(instructions: Instruction[], address: number) {
    instructions.forEach((instr, index) => {
      if (address + index < 0 || address + index >= this.Memory.length) {
        throw new Error("Memory access out of bounds");
      }
      this.addInstruction(instr, address + index);
      this.Memory[address + index] = instr.encode();
    });
  }

  addData(data: Uint16Array, address: number) {
    if (address < 0 || address + data.length > this.Memory.length) {
      throw new Error("Memory access out of bounds");
    }
    this.Memory.set(data, address);
  }

  addStartAddress(address: number) {
    if (address < 0 || address >= this.Memory.length) {
      throw new Error("Starting address out of bounds");
    }
    this.PC = address;
  }

  addReservationStation(name: string, unit: OpCode, cycles_needed: number) {
    this.RS.push(new ReservationStation(name, unit, cycles_needed));
  }

  Issue(): void {
    // Fetch instruction from memory instead of Instructions array
    if (this.isJumpPending) {
      return;
    }
    const instrAddr = this.PC;
    if (instrAddr < 0 || instrAddr >= this.Memory.length) return;
    const encodedInstr = this.Memory[instrAddr];
    if (encodedInstr === 0) return; // treat 0 as NOP or empty
    const instr = Instruction.decode(encodedInstr);
    if (this.PC < 65536) {
      if (instr.getOpcode() == OpCode.LOAD) {
        for (const element of this.RS) {
          if (element.busy == false && element.unit == OpCode.LOAD) {
            if (this.RegisterStatus[instr.getrB()!] == 0) {
              element.Vj = this.Registers[instr.getrB()!];
              element.Qj = null;
            } else {
              element.Qj = this.RegisterStatus[instr.getrB()!];
              element.Vj = null;
            }
            element.busy = true;
            element.Operation = "LOAD";
            element.instruction = instr.clone();
            element.PC_Original = this.PC;
            this.RegisterStatus[instr.getrA()!] = element.name;
            element.A = instr.getOffset() ?? null;
            this.IssuedTracker.push({
              Instruction: instr.clone(),
              clock: this.clock,
              RS: element,
            });
            this.PC++;
            if (this.isBranchPending) {
              this.IssuedAfterBranch++;
            }
            break;
          }
        }
      } else if (instr.getOpcode() == OpCode.STORE) {
        for (const element of this.RS) {
          if (element.busy == false && element.unit == OpCode.STORE) {
            if (this.RegisterStatus[instr.getrB()!] == 0) {
              element.Vj = this.Registers[instr.getrB()!];
              element.Qj = null;
            } else {
              element.Qj = this.RegisterStatus[instr.getrB()!];
              element.Vj = null;
            }
            element.busy = true;
            element.A = instr.getOffset() ?? null;
            if (this.RegisterStatus[instr.getrA()!] == 0) {
              element.Vk = this.Registers[instr.getrA()!];
              element.Qk = null;
            } else {
              element.Qk = this.RegisterStatus[instr.getrA()!];
              element.Vk = null;
            }
            this.IssuedTracker.push({
              Instruction: instr.clone(),
              clock: this.clock,
              RS: element,
            });
            element.instruction = instr.clone();
            element.PC_Original = this.PC;
            element.Operation = "STORE";
            if (this.isBranchPending) {
              this.IssuedAfterBranch++;
            }
            this.PC++;
            break;
          }
        }
      } else if (
        instr.getOpcode() == OpCode.ADD ||
        instr.getOpcode() == OpCode.SUB ||
        instr.getOpcode() == OpCode.NOR ||
        instr.getOpcode() == OpCode.MUL
      ) {
        for (const element of this.RS) {
          if (
            element.busy == false &&
            element.unit ==
              (instr.getOpcode() == OpCode.MUL
                ? OpCode.MUL
                : instr.getOpcode() == OpCode.NOR
                  ? OpCode.NOR
                  : instr.getOpcode() == OpCode.ADD
                    ? OpCode.ADD
                    : OpCode.ADD)
          ) {
            if (this.RegisterStatus[instr.getrB()!] == 0) {
              element.Vj = this.Registers[instr.getrB()!];
              element.Qj = null;
            } else {
              element.Qj = this.RegisterStatus[instr.getrB()!];
              element.Vj = null;
            }
            if (this.RegisterStatus[instr.getrC()!] == 0) {
              element.Vk = this.Registers[instr.getrC()!];
              element.Qk = null;
            } else {
              element.Qk = this.RegisterStatus[instr.getrC()!];
              element.Vk = null;
            }
            this.IssuedTracker.push({
              Instruction: instr.clone(),
              clock: this.clock,
              RS: element,
            });
            element.busy = true;
            element.instruction = instr.clone();
            element.PC_Original = this.PC;
            element.Operation =
              instr.getOpcode() == OpCode.ADD
                ? "ADD"
                : instr.getOpcode() == OpCode.SUB
                  ? "SUB"
                  : instr.getOpcode() == OpCode.NOR
                    ? "NOR"
                    : "MUL";
            this.RegisterStatus[instr.getrA()!] = element.name;
            this.PC++;
            if (this.isBranchPending) {
              this.IssuedAfterBranch++;
            }
            break;
          }
        }
      } else if (instr.getOpcode() == OpCode.BEQ) {
        for (const element of this.RS) {
          if (element.busy == false && element.unit == OpCode.BEQ) {
            if (this.RegisterStatus[instr.getrA()!] == 0) {
              element.Vj = this.Registers[instr.getrA()!];
              element.Qj = null;
            } else {
              element.Qj = this.RegisterStatus[instr.getrA()!];
              element.Vj = null;
            }
            if (this.RegisterStatus[instr.getrB()!] == 0) {
              element.Vk = this.Registers[instr.getrB()!];
              element.Qk = null;
            } else {
              element.Qk = this.RegisterStatus[instr.getrB()!];
              element.Vk = null;
            }
            this.IssuedTracker.push({
              Instruction: instr.clone(),
              clock: this.clock,
              RS: element,
            });
            element.A = instr.getOffset() ?? null;
            if (this.isBranchPending) {
              this.IssuedAfterBranch++;
            }
            element.Operation = "BEQ";
            element.busy = true;
            element.instruction = instr.clone();
            element.PC_Original = this.PC;
            this.isBranchPending = true;
            this.branchInstructions++;
            break;
          }
        }
      } else if (
        instr.getOpcode() == OpCode.CALL ||
        instr.getOpcode() == OpCode.RET
      ) {
        for (const element of this.RS) {
          if (element.busy == false && element.unit == OpCode.CALL) {
            element.busy = true;
            element.A =
              instr.getOpcode() == OpCode.CALL
                ? (instr.getLabel() ?? null)
                : this.Registers[1];
            element.Operation =
              instr.getOpcode() == OpCode.CALL ? "CALL" : "RET";
            this.IssuedTracker.push({
              Instruction: instr.clone(),
              clock: this.clock,
              RS: element,
            });
            element.instruction = instr.clone();
            element.PC_Original = this.PC;
            this.isJumpPending = true;
            if (this.isBranchPending) {
              this.IssuedAfterBranch++;
            }
            break;
          }
        }
      }
    }
  }

  execute(): void {
    for (const element of this.RS) {
      if (element.unit == OpCode.LOAD) {
        if (
          element.busy == true &&
          element.cycles_passed == element.cycles_needed_to_compute_address &&
          this.isBranchPending == false
        ) {
          element.A = element.Vj! + element.A!;
        }

        if (
          element.busy == true &&
          element.cycles_passed == element.cycles_needed &&
          this.isBranchPending == false
        ) {
          let hazard: boolean = false;
          for (const element2 of this.RS) {
            if (
              element2.unit == OpCode.STORE &&
              element2.busy == true &&
              element2.PC_Original! < element.PC_Original! &&
              element2.A == element.A
            ) {
              // If there is a store instruction that is pending and has the same address, we need to wait for it to complete
              element.cycles_passed = element.cycles_needed - 1;
              hazard = true;
              break;
            }
          }
          if (!hazard) {
            element.result = this.Memory[element.A!];
            this.ExecutedTracker.push({
              Instruction: element.instruction!.clone(),
              clock: this.clock,
              RS: element,
            });
          }
        }
      }

      //-------------------------------------------------------------

      if (element.unit == OpCode.STORE) {
        if (
          element.busy == true &&
          element.cycles_passed == element.cycles_needed_to_compute_address &&
          this.isBranchPending == false
        ) {
          element.A = element.Vj! + element.A!;
        }

        if (
          element.busy == true &&
          element.cycles_passed == element.cycles_needed &&
          this.isBranchPending == false
        ) {
          let hazard: boolean = false;
          for (const element2 of this.RS) {
            if (
              (element2.unit == OpCode.LOAD || element2.unit == OpCode.STORE) &&
              element2.busy == true &&
              element2.PC_Original! < element.PC_Original! &&
              element2.A == element.A
            ) {
              // If there is a load/store instruction that is pending and has the same address, we need to wait for it to complete
              element.cycles_passed = element.cycles_needed - 1;
              hazard = true;
              break;
            }
          }
          if (!hazard) {
            this.Memory[element.A!] = element.Vk!;
            element.busy = false;
            element.Qj = null;
            element.Qk = null;
            element.Vj = null;
            element.Vk = null;
            this.ExecutedTracker.push({
              Instruction: element.instruction!.clone(),
              clock: this.clock,
              RS: element,
            });
          }
        }
      }

      //-------------------------------------------------------------

      if (element.unit == OpCode.BEQ) {
        if (
          element.busy == true &&
          element.cycles_passed == element.cycles_needed
        ) {
          if (element.Vj == element.Vk) {
            this.PC = element.A! + element.PC_Original! + 1;
            this.isBranchPending = false;
            this.branchMispredictions++;
            this.IssuedTracker.splice(
              this.IssuedTracker.length - this.IssuedAfterBranch
            );
            this.IssuedAfterBranch = 0;
            for (const rs of this.RS) {
              if (rs.PC_Original! > element.PC_Original!) {
                rs.busy = false;
                rs.result = null;
                rs.instruction = null;
                rs.Qj = null;
                rs.Qk = null;
                rs.Vj = null;
                rs.Vk = null;
              }
            }
          } else {
            this.PC = element.PC_Original! + 1;
            this.isBranchPending = false;
          }
          element.busy = false;
          element.Qj = null;
          element.Qk = null;
          element.Vj = null;
          element.Vk = null;
          this.ExecutedTracker.push({
            Instruction: element.instruction!.clone(),
            clock: this.clock,
            RS: element,
          });
        }
      }

      //-------------------------------------------------------------
      if (element.unit == OpCode.CALL) {
        //CALL and RET
        if (
          element.busy == true &&
          element.cycles_passed == element.cycles_needed &&
          this.isBranchPending == false
        ) {
          if (element.Operation == "CALL") {
            this.Registers[1] = element.PC_Original! + 1;
            this.PC = element.A!;
            this.isJumpPending = false;
          }

          if (element.Operation == "RET") {
            this.PC = element.A!;
            this.isJumpPending = false;
          }
          element.busy = false;
          element.Qj = null;
          element.Qk = null;
          element.Vj = null;
          element.Vk = null;
          this.ExecutedTracker.push({
            Instruction: element.instruction!.clone(),
            clock: this.clock,
            RS: element,
          });
        }
      }
      //-------------------------------------------------------------
      if (element.unit == OpCode.ADD) {
        if (
          element.busy == true &&
          element.cycles_passed == element.cycles_needed &&
          this.isBranchPending == false
        ) {
          if (element.Operation == "ADD") {
            element.result = element.Vj! + element.Vk!;
          }
          if (element.Operation == "SUB") {
            element.result = element.Vj! - element.Vk!;
          }
          this.ExecutedTracker.push({
            Instruction: element.instruction!.clone(),
            clock: this.clock,
            RS: element,
          });
        }
      }
      //-------------------------------------------------------------
      if (element.unit == OpCode.NOR) {
        if (
          element.busy == true &&
          element.cycles_passed == element.cycles_needed &&
          this.isBranchPending == false
        ) {
          element.result = ~(element.Vj! | element.Vk!);
          this.ExecutedTracker.push({
            Instruction: element.instruction!.clone(),
            clock: this.clock,
            RS: element,
          });
        }
      }
      //-------------------------------------------------------------
      if (element.unit == OpCode.MUL) {
        if (
          element.busy == true &&
          element.cycles_passed == element.cycles_needed &&
          this.isBranchPending == false
        ) {
          element.result = element.Vj! * element.Vk!;
          this.ExecutedTracker.push({
            Instruction: element.instruction!.clone(),
            clock: this.clock,
            RS: element,
          });
        }
      }
    }
  }
  WriteBack(): void {
    //Priotitize older instructions to be written back first
    for (const element of this.IssuedTracker) {
      if (
        element.RS.result != null &&
        element.RS.cycles_passed > element.RS.cycles_needed &&
        this.isBranchPending == false &&
        this.CDB == null
      ) {
        if (
          element.RS.unit == OpCode.LOAD ||
          element.RS.unit == OpCode.ADD ||
          element.RS.unit == OpCode.NOR ||
          element.RS.unit == OpCode.MUL
        ) {
          this.CDB = element.RS.result;
          for (let i = 0; i < this.RegisterStatus.length; i++) {
            if (this.RegisterStatus[i] === element.RS.name) {
              this.Registers[i] = this.CDB;
              this.RegisterStatus[i] = 0;
              break;
            }
          }
          for (const element2 of this.RS) {
            if (element2.Qj == element.RS.name) {
              element2.Vj = this.CDB;
              element2.Qj = null;
            }
            if (element2.Qk == element.RS.name) {
              element2.Vk = this.CDB;
              element2.Qk = null;
            }
          }
          element.RS.busy = false;
          element.RS.result = null;
          this.CDB = null;
          this.WriteBackTracker.push({
            Instruction: element.Instruction.clone(),
            clock: this.clock,
            RS: element.RS,
          });
          break;
        }
      }
    }
  }
  incrementCyclesPassed(): void {
    for (const rs of this.RS) {
      // Skip if not busy or already completed
      if (!rs.busy || rs.cycles_passed >= rs.cycles_needed) continue;

      // Only increment if operands are ready
      if (rs.Qj === null && rs.Qk === null) {
        rs.cycles_passed++;
      }
    }
  }
  step(): void {
    this.incrementCyclesPassed();
    this.Issue();
    this.execute();
    this.WriteBack();
    this.clock++;
  }
}
