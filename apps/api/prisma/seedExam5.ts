import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const OPTION_BANK: Record<string, string> = {
  "Code 01": "โมดูลควบคุม I/O (I/O Module / Controller)",
  "Code 02": "การตอบสนองการขัดจังหวะ (Interrupt Handling)",
  "Code 03": "ระบบบัส (System Bus)",
  "Code 04": "โปรแกรมเมเบิล อินเทอร์รัพท์ คอนโทรลเลอร์ (PIC / Interrupt Controller)",
  "Code 05": "บัสข้อมูล (Data Bus)",
  "Code 06": "ฮาร์ดแวร์อินเทอร์รัพท์ (Hardware Interrupt)",
  "Code 07": "การระบุตำแหน่งแอดเดรสในหน่วยความจำ (Memory Address Determination)",
  "Code 08": "ปริมาณข้อมูลที่สามารถถ่ายโอนได้ในแต่ละครั้ง",
  "Code 09": "Memory-Mapped I/O",
  "Code 10": "ระบบบัส I/O (I/O Bus System)",
  "Code 11": "โมดูลรับและแสดงผล (I/O Module)",
  "Code 12": "การเข้าถึงหน่วยความจำโดยตรง (Direct Memory Access - DMA)",
  "Code 13": "การโอนย้ายข้อมูลแบบอินเทอร์รัพท์ (Interrupt Driven I/O)",
  "Code 14": "VDU Output Controller",
  "Code 15": "พอร์ต (I/O Port)",
  "Code 16": "Vectored Interrupt",
  "Code 17": "โครงสร้างการเชื่อมโยงภายในคอมพิวเตอร์ (Computer Interconnection Structure)",
  "Code 18": "Nonmaskable Interrupt (NMI)",
  "Code 19": "สัญญาณอินเทอร์รัปต์ (Interrupt Signals)",
  "Code 20": "ผู้ครอบครองบัส (Bus Mastership)",
  "Code 21": "สองทาง (Bidirectional)",
  "Code 22": "ซอฟต์แวร์อินเทอร์รัพท์ (Software Interrupt / Trap)",
  "Code 23": "บัฟเฟอร์ข้อมูล (Data Buffer Registers)",
  "Code 24": "ตารางเวกเตอร์ขัดจังหวะ (Interrupt Vector Table - IVT)",
  "Code 25": "การดึงคำสั่ง (Instruction Fetch)",
  "Code 26": "สัญญาณขัดจังหวะการทำงาน (Interrupt Signal)",
  "Code 27": "Output Buffer",
  "Code 28": "หน่วยประมวลผลกลาง (CPU)",
  "Code 29": "เพียงเส้นเดียว (Single Interrupt Request Line)",
  "Code 30": "สัญญาณ Memory Read",
  "Code 31": "Non-Vectored Interrupt",
  "Code 32": "Disk I/O Controller",
  "Code 33": "จำนวนไบต์หรือบล็อกที่จะโอนย้าย (Transfer Byte/Block Count)",
  "Code 34": "สัญญาณ I/O Read",
  "Code 35": "Maskable Interrupt (MI)",
  "Code 36": "Memory Write",
  "Code 37": "สายสัญญาณบัสข้อมูล (Data Bus Line)",
  "Code 38": "Isolated I/O (Port-Mapped I/O)",
  "Code 39": "บัสแอดเดรส (Address Bus)",
  "Code 40": "การโอนย้ายข้อมูลแบบโปรแกรม (Programmed I/O)",
  "Code 41": "หน่วยความจำหลักและอุปกรณ์รับแสดงผลข้อมูล (Main Memory and I/O Devices)",
  "Code 42": "บัสหน่วยความจำ (Memory Bus)",
};

interface QuestionDef {
  num: number;
  prompt: string;
  correctCode: string;
}

const QUESTIONS: QuestionDef[] = [
  {
    num: 1,
    prompt: "สถาปัตยกรรมที่อธิบายถึงวิธีการที่ส่วนประกอบหลักของระบบคอมพิวเตอร์ ได้แก่ CPU, หน่วยความจำหลัก และโมดูล I/O เชื่อมต่อและสื่อสารกัน เรียกว่า ______",
    correctCode: "Code 17",
  },
  {
    num: 2,
    prompt: "ช่องทางสื่อสารร่วมหลักที่ทำหน้าที่เป็นหัวใจสำคัญในการเชื่อมโยงการสื่อสารข้อมูลและสัญญาณควบคุมระหว่างองค์ประกอบหลักทั้งหมดภายในระบบคอมพิวเตอร์ คือ ______",
    correctCode: "Code 03",
  },
  {
    num: 3,
    prompt: "ส่วนประกอบหลักของระบบคอมพิวเตอร์ที่ทำหน้าที่ควบคุมและประมวลผลชุดคำสั่งต่าง ๆ ของโปรแกรม คือ ______",
    correctCode: "Code 28",
  },
  {
    num: 4,
    prompt: "ส่วนประกอบหลักที่ทำหน้าที่เป็นอินเทอร์เฟซตัวกลางในการเชื่อมต่อ และประสานงานการแลกเปลี่ยนข้อมูลระหว่างคอมพิวเตอร์กับอุปกรณ์ภายนอก เช่น แป้นพิมพ์ หรือฮาร์ดดิสก์ คือ ______",
    correctCode: "Code 11",
  },
  {
    num: 5,
    prompt: "กลุ่มสายสัญญาณบัสที่มีลักษณะการทำงานแบบทางเดียว (Unidirectional) ทำหน้าที่ส่งตำแหน่งอ้างอิงที่ CPU ต้องการเข้าถึงไปยังหน่วยความจำหรืออุปกรณ์ I/O คือ ______",
    correctCode: "Code 39",
  },
  {
    num: 6,
    prompt: "กลุ่มสายสัญญาณบัสที่มีลักษณะการทำงานแบบสองทาง (Bidirectional) ทำหน้าที่รับส่งชุดข้อมูลหรือคำสั่งจริงระหว่าง CPU, หน่วยความจำ และโมดูล I/O คือ ______",
    correctCode: "Code 05",
  },
  {
    num: 7,
    prompt: "โมดูลควบคุม I/O ที่เชื่อมต่อกับบัสระบบทั้งสามชนิดเพื่อจัดการการอ่านและเขียนข้อมูลกับอุปกรณ์จัดเก็บข้อมูล เช่น Hard Disk หรือ SSD คือ ______",
    correctCode: "Code 32",
  },
  {
    num: 8,
    prompt: "โมดูลควบคุมเอาต์พุตที่เชื่อมต่อกับบัสระบบเพื่อส่งข้อมูลประมวลผลภาพออกไปยังจอภาพแสดงผล (Monitor/Display) เรียกว่า ______",
    correctCode: "Code 14",
  },
  {
    num: 9,
    prompt: "บัสของหน่วยประมวลผลกลาง (CPU Bus หรือ System Bus) เป็นเส้นทางหลักที่ CPU ใช้สื่อสารและแลกเปลี่ยนข้อมูลกับส่วนประกอบหลักใดในระบบคอมพิวเตอร์ ______",
    correctCode: "Code 41",
  },
  {
    num: 10,
    prompt: "ความกว้างของสายสัญญาณบัสข้อมูล (Data Bus Width) เป็นปัจจัยสำคัญทางสถาปัตยกรรมที่ส่งผลโดยตรงต่อ ______",
    correctCode: "Code 08",
  },
  {
    num: 11,
    prompt: "หน้าที่การทำงานของ CPU Bus ในกระบวนการดึงชุดคำสั่งจากหน่วยความจำหลักมายังตัว CPU เพื่อเตรียมทำการแปลความหมายและประมวลผล เรียกว่า ______",
    correctCode: "Code 25",
  },
  {
    num: 12,
    prompt: "หน้าที่การทำงานของ CPU Bus เมื่อมีสัญญาณแจ้งเหตุการณ์เร่งด่วนส่งมาจากอุปกรณ์ภายนอก เพื่อให้ CPU หยุดงานหลักชั่วคราวมาจัดการ เรียกว่า ______",
    correctCode: "Code 02",
  },
  {
    num: 13,
    prompt: "สัญญาณสั่งการบนบัสควบคุมที่ CPU ส่งออกไปยังหน่วยความจำ เพื่อแจ้งว่าต้องการบันทึกข้อมูลลงในแอดเดรสที่ระบุ คือ ______",
    correctCode: "Code 36",
  },
  {
    num: 14,
    prompt: "กลุ่มสัญญาณประเภทขอความสนใจที่อุปกรณ์ I/O Module ส่งผ่านสายสัญญาณควบคุมไปยัง CPU เพื่อขอให้หยุดการทำงานชั่วคราวมาให้บริการ คือ ______",
    correctCode: "Code 19",
  },
  {
    num: 15,
    prompt: "กลุ่มสายสัญญาณที่ทำหน้าที่เป็นช่องทางสื่อสารเฉพาะสำหรับการแลกเปลี่ยนข้อมูลและคำสั่งระหว่าง CPU กับหน่วยความจำหลักโดยตรง เรียกว่า ______",
    correctCode: "Code 42",
  },
  {
    num: 16,
    prompt: "การที่ CPU ส่งสัญญาณแอดเดรสผ่านบัสแอดเดรสของ Memory Bus มีหน้าที่หลักสำคัญเพื่อ ______",
    correctCode: "Code 07",
  },
  {
    num: 17,
    prompt: "สัญญาณควบคุมบน Memory Bus ที่ CPU ส่งออกไปเพื่อสั่งให้หน่วยความจำส่งข้อมูล ณ ตำแหน่งแอดเดรสที่กำหนดออกมาวางบน Data Bus คือ ______",
    correctCode: "Code 30",
  },
  {
    num: 18,
    prompt: "ทิศทางการเดินทางของข้อมูลบนสาย Data Bus ของ Memory Bus ในระหว่างการอ่านและเขียนข้อมูล มีลักษณะเป็นแบบ ______",
    correctCode: "Code 21",
  },
  {
    num: 19,
    prompt: "กลุ่มของสายสัญญาณสื่อสารที่ทำหน้าที่เป็นช่องทางมาตรฐานเชื่อมต่อระหว่าง CPU/Memory กับอุปกรณ์รับและแสดงผลข้อมูลประเภทต่าง ๆ คือ ______",
    correctCode: "Code 10",
  },
  {
    num: 20,
    prompt: "สัญญาณควบคุมที่ CPU ส่งไปยัง I/O Module เพื่อสั่งให้อุปกรณ์ I/O ส่งข้อมูลที่พร้อมอยู่ในบัฟเฟอร์ออกมายัง Data Bus คือ ______",
    correctCode: "Code 34",
  },
  {
    num: 21,
    prompt: "วงจรฮาร์ดแวร์ที่ทำหน้าที่เป็น \"ตัวเชื่อมต่อหรือล่าม\" รองรับความแตกต่างทางไฟฟ้าและสถาปัตยกรรมระหว่างระบบบัสคอมพิวเตอร์กับอุปกรณ์ภายนอก เรียกว่า ______",
    correctCode: "Code 01",
  },
  {
    num: 22,
    prompt: "หน่วยความจำชั่วคราวขนาดเล็กภายใน I/O Module ที่ทำหน้าที่รองรับความแตกต่างของความเร็วการทำงานระหว่าง CPU กับอุปกรณ์ I/O คือ ______",
    correctCode: "Code 23",
  },
  {
    num: 23,
    prompt: "จุดเชื่อมต่อเชิงตรรกะ (Logical Connection Point) ภายใน I/O Module ซึ่งมีหมายเลขอ้างอิงเฉพาะตัวที่ CPU ใช้ติดต่อกับอุปกรณ์ I/O เรียกว่า ______",
    correctCode: "Code 15",
  },
  {
    num: 24,
    prompt: "สถาปัตยกรรมการจัดสรรพอร์ตที่กำหนดให้พอร์ต I/O มีพื้นที่แอดเดรสแยกต่างหากจากหน่วยความจำหลัก และต้องใช้ชุดคำสั่งเฉพาะ เช่น IN หรือ OUT คือ ______",
    correctCode: "Code 38",
  },
  {
    num: 25,
    prompt: "สถาปัตยกรรมการกำหนดแอดเดรสพอร์ต I/O ให้ใช้พื้นที่แอดเดรสเดียวกับหน่วยความจำหลัก ทำให้ CPU สามารถใช้คำสั่ง LOAD และ STORE ในการโอนย้ายข้อมูลได้ คือ ______",
    correctCode: "Code 09",
  },
  {
    num: 26,
    prompt: "ในขั้นตอนที่ CPU ส่งข้อมูลไปแสดงผลที่หน้าจอ ข้อมูลตัวอักษรหรือภาพจะถูกนำไปพักไว้ที่หน่วยความจำชั่วคราวส่วนใดของ I/O Module ก่อนส่งออกไปอุปกรณ์ภายนอก ______",
    correctCode: "Code 27",
  },
  {
    num: 27,
    prompt: "เทคนิคการโอนย้ายข้อมูลที่ CPU ต้องคอยวนลูปอ่าน Status Register ของ I/O Module เพื่อตรวจสอบสถานะความพร้อมอยู่ตลอดเวลา (Polling) เรียกว่า ______",
    correctCode: "Code 40",
  },
  {
    num: 28,
    prompt: "เทคนิคการโอนย้ายข้อมูลที่ถูกพัฒนาเพื่อแก้ไขปัญหา CPU เสียเวลา Polling โดยให้อุปกรณ์ I/O เป็นฝ่ายส่งสัญญาณแจ้งเมื่อพร้อมโอนย้ายข้อมูล เรียกว่า ______",
    correctCode: "Code 13",
  },
  {
    num: 29,
    prompt: "ชิปฮาร์ดแวร์พิเศษที่ทำหน้าที่รวบรวม จัดคิวตามลำดับความสำคัญ และส่งสัญญาณขัดจังหวะจากอุปกรณ์ I/O หลายตัวไปยัง CPU เรียกว่า ______",
    correctCode: "Code 04",
  },
  {
    num: 30,
    prompt: "ในระบบที่มี Interrupt Controller สัญญาณขอขัดจังหวะที่ออกจาก Interrupt Controller ไปยัง CPU จะมีลักษณะคือ ______",
    correctCode: "Code 29",
  },
  {
    num: 31,
    prompt: "สัญญาณการขัดจังหวะชนิดที่มีความสำคัญสูงสุด ไม่สามารถถูกปิดกั้นหรือสั่งละเว้นโดย CPU ได้ มักใช้แจ้งข้อผิดพลาดร้ายแรงของฮาร์ดแวร์ คือ ______",
    correctCode: "Code 18",
  },
  {
    num: 32,
    prompt: "สัญญาณการขัดจังหวะที่ CPU สามารถสั่งปิดกั้น (Mask) ชั่วคราวได้ผ่านการตั้งค่าใน Status Register เมื่อ CPU กำลังทำภารกิจสำคัญ เรียกว่า ______",
    correctCode: "Code 35",
  },
  {
    num: 33,
    prompt: "สัญญาณขัดจังหวะที่เกิดจากอุปกรณ์ฮาร์ดแวร์ภายนอก เช่น คีย์บอร์ด เมาส์ หรือดิสก์ไดรฟ์ ส่งสัญญาณผ่านสายสัญญาณมายัง CPU เรียกว่า ______",
    correctCode: "Code 06",
  },
  {
    num: 34,
    prompt: "สัญญาณขัดจังหวะที่เกิดขึ้นจากการสั่งงานของโปรแกรม หรือเกิดจากข้อผิดพลาดในตัวคำสั่งเอง เช่น การหารด้วยศูนย์ หรือการเรียกใช้ System Call เรียกว่า ______",
    correctCode: "Code 22",
  },
  {
    num: 35,
    prompt: "ระบบขัดจังหวะที่เมื่อเกิดเหตุการณ์ขึ้น CPU ทราบเพียงว่ามี Interrupt แต่ไม่ทราบว่ามาจากอุปกรณ์ใด จนต้องเสียเวลา Polling สอบถามทีละอุปกรณ์ เรียกว่า ______",
    correctCode: "Code 31",
  },
  {
    num: 36,
    prompt: "ระบบขัดจังหวะที่อุปกรณ์ I/O หรือ Interrupt Controller จะส่งรหัสเวกเตอร์เฉพาะระบุตำแหน่งโปรแกรมบริการไปยัง CPU ได้โดยตรง เรียกว่า ______",
    correctCode: "Code 16",
  },
  {
    num: 37,
    prompt: "ตารางดรรชนีที่จัดเก็บอยู่ในหน่วยความจำหลัก (RAM) ทำหน้าที่เก็บแอดเดรสเริ่มต้นของโปรแกรมบริการการขัดจังหวะ (ISR) ของอุปกรณ์แต่ละตัว เรียกว่า ______",
    correctCode: "Code 24",
  },
  {
    num: 38,
    prompt: "ในกระบวนการ Vectored Interrupt รหัส Vector Number ของอุปกรณ์จะถูกส่งจาก Interrupt Controller ไปยัง CPU ผ่านทางเส้นทางบัสชนิดใด ______",
    correctCode: "Code 37",
  },
  {
    num: 39,
    prompt: "กลไกการโอนย้ายข้อมูลที่อนุญาตให้โมดูล I/O สามารถรับส่งข้อมูลกับหน่วยความจำหลักได้โดยตรง โดยไม่ต้องผ่านการประมวลผลของ CPU ในทุก ๆ ไบต์ เรียกว่า ______",
    correctCode: "Code 12",
  },
  {
    num: 40,
    prompt: "เมื่อ DMA Controller ได้รับคำสั่งให้เริ่มโอนย้ายข้อมูล มันจะต้องส่งสัญญาณ Bus Request ไปยัง CPU เพื่อขอเข้ายึดทำหน้าที่เป็น ______",
    correctCode: "Code 20",
  },
  {
    num: 41,
    prompt: "ในขั้นตอนการตั้งค่า (Initialization) ของ DMA นอกจาก CPU จะต้องกำหนดแอดเดรสเริ่มต้น และทิศทางการโอนย้ายแล้ว ยังต้องส่งข้อมูลสำคัญเรื่อง ______",
    correctCode: "Code 33",
  },
  {
    num: 42,
    prompt: "เมื่อ DMA Controller ทำการโอนย้ายข้อมูลระหว่างฮาร์ดดิสก์กับ RAM ครบตามจำนวนที่ตั้งไว้แล้ว จะแจ้งเตือนให้ CPU ทราบด้วยการส่ง ______",
    correctCode: "Code 26",
  },
];

const STUDENT_NAMES = [
  { first: "กิตติพงษ์", last: "สุขเกษม" },
  { first: "จิรวัฒน์", last: "แสงอรุณ" },
  { first: "ชลธี", last: "วงษ์สวรรค์" },
  { first: "ณัฐวุฒิ", last: "ปัญญาวงศ์" },
  { first: "ทศพล", last: "เรืองโรจน์" },
  { first: "ธนกฤต", last: "บุญส่ง" },
  { first: "ธีรภัทร์", last: "ศิริชัย" },
  { first: "นพดล", last: "แก้วมณี" },
  { first: "ปวริศร", last: "คงมั่น" },
  { first: "พงศธร", last: "จิตสง่า" },
  { first: "ภานุพงศ์", last: "รัตนโกสินทร์" },
  { first: "เมธาสิทธิ์", last: "ทองใบ" },
  { first: "ยุทธนา", last: "คำดี" },
  { first: "วรากร", last: "ชินวัตร" },
  { first: "ศิรวิชญ์", last: "สุรวงศ์" },
  { first: "สิทธิพงษ์", last: "ดวงแก้ว" },
  { first: "อนิรุตต์", last: "ทักษิณ" },
  { first: "เอกลักษณ์", last: "พิทักษ์" },
  { first: "กัญญารัตน์", last: "เจริญสุข" },
  { first: "ชลธิชา", last: "ศรีสว่าง" },
  { first: "ณัชชา", last: "วิเศษศิลป์" },
  { first: "ทิพวรรณ", last: "มีโชค" },
  { first: "ธิดารัตน์", last: "พรหมประสิทธิ์" },
  { first: "นภัสสร", last: "อินทร์ทอง" },
  { first: "ปิยดา", last: "วงศ์ประเสริฐ" },
  { first: "พิมพิศา", last: "เพชรดี" },
  { first: "รพีพร", last: "จันทร์เพ็ญ" },
  { first: "ลลิตา", last: "มณีวรรณ" },
  { first: "วริศรา", last: "งามยิ่ง" },
  { first: "ศุภัสสร", last: "สมบัติเจริญ" },
];

async function main() {
  console.log("Seeding Chapter 5 Exam & 30 Students into XAMPP MySQL...");
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Teacher
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@netsechub.dev" },
    update: {
      firstName: "วิทวัส",
      lastName: "ทิพย์สุวรรณ",
      fullName: "ดร.วิทวัส ทิพย์สุวรรณ",
      avatarUrl: "/teacher.png",
    },
    create: {
      email: "teacher@netsechub.dev",
      passwordHash,
      firstName: "วิทวัส",
      lastName: "ทิพย์สุวรรณ",
      fullName: "ดร.วิทวัส ทิพย์สุวรรณ",
      role: "TEACHER",
      avatarUrl: "/teacher.png",
    },
  });
  console.log(`Teacher verified: ${teacher.fullName}`);

  // 2. Course
  const course = await prisma.course.upsert({
    where: { code: "CPE-321" },
    update: {},
    create: {
      code: "CPE-321",
      title: "สถาปัตยกรรมคอมพิวเตอร์และระบบบัส (Microprocessor & Bus)",
      description: "หลักการทำงานของ Microprocessor, System Bus, I/O Interfacing และระบบการควบคุมหน่วยความจำ",
      termLabel: "2/2567",
      teacherId: teacher.id,
    },
  });

  // 3. Create 30 Students & Enroll them
  const studentIds: string[] = [];
  for (let i = 1; i <= 30; i++) {
    const pad = String(i).padStart(2, "0");
    const email = `student${pad}@netsechub.dev`;
    const studentCode = `6701${String(i).padStart(4, "0")}`;
    const info = STUDENT_NAMES[i - 1];

    const student = await prisma.user.upsert({
      where: { email },
      update: {
        studentCode,
        faculty: "คณะวิศวกรรมศาสตร์",
        major: "วิศวกรรมคอมพิวเตอร์",
      },
      create: {
        email,
        passwordHash,
        firstName: info.first,
        lastName: info.last,
        fullName: `${info.first} ${info.last}`,
        role: "STUDENT",
        studentCode,
        faculty: "คณะวิศวกรรมศาสตร์",
        major: "วิศวกรรมคอมพิวเตอร์",
      },
    });

    await prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId: student.id } },
      update: {},
      create: { courseId: course.id, studentId: student.id },
    });

    studentIds.push(student.id);
  }
  console.log(`Created & enrolled 30 students (student01 - student30)`);

  // Also enroll default student@netsechub.dev
  const defaultStudent = await prisma.user.findUnique({ where: { email: "student@netsechub.dev" } });
  if (defaultStudent) {
    await prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId: defaultStudent.id } },
      update: {},
      create: { courseId: course.id, studentId: defaultStudent.id },
    });
  }

  // 4. Create Exam
  const examTitle = "ข้อสอบท้ายบทที่ 5 เรื่อง Microprocessor and Bus";
  let exam = await prisma.exam.findFirst({
    where: { title: examTitle },
  });

  if (exam) {
    // Old attempts reference the old question ids; clear them along with the questions.
    await prisma.examAttempt.deleteMany({ where: { examId: exam.id } });
    await prisma.question.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.update({
      where: { id: exam.id },
      data: {
        timePerQuestionSeconds: 300,
        maxAttempts: 0, // unlimited retakes
        shuffleQuestions: true,
        shuffleOptions: true,
        description:
          "แบบทดสอบท้ายบทที่ 5 เรื่อง Microprocessor and Bus (จำนวน 42 ข้อ จำกัดเวลาข้อละ 5 นาที แบบเติมคำจากคลังคำตอบ รหัสคำตอบสุ่มใหม่ทุกข้อและไม่ซ้ำกันในแต่ละคน)",
      },
    });
    console.log("Updated existing exam questions (previous attempts cleared)");
  } else {
    exam = await prisma.exam.create({
      data: {
        courseId: course.id,
        title: examTitle,
        description: "แบบทดสอบท้ายบทที่ 5 เรื่อง Microprocessor and Bus (จำนวน 42 ข้อ จำกัดเวลาข้อละ 5 นาที แบบเติมคำจากคลังคำตอบ รหัสคำตอบสุ่มใหม่ทุกข้อและไม่ซ้ำกันในแต่ละคน)",
        durationMinutes: 210, // 42 questions * 5 minutes
        passScorePercent: 60,
        maxAttempts: 0, // unlimited retakes
        status: "OPEN",
        requireFullscreen: true,
        blockClipboard: true,
        blockContextMenu: true,
        maxViolations: 3,
        shuffleQuestions: true,
        shuffleOptions: true,
        timePerQuestionSeconds: 300, // 5 minutes per question, enforced server-side
      },
    });
    console.log(`Created exam: ${exam.id}`);
  }

  // 5. Insert all 42 Questions
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    // Fill-in-the-blank from the shared answer bank, as in the Word paper: every
    // question offers all 42 bank entries. The client shows them under per-student,
    // per-question shuffled codes, so "Code 17" means something different on every screen.
    const optionsData = Object.entries(OPTION_BANK).map(([code, label], idx) => ({
      label,
      isCorrect: code === q.correctCode,
      order: idx,
    }));

    await prisma.question.create({
      data: {
        examId: exam.id,
        type: "FILL_IN_BANK",
        // No source number in the prompt: each student sees a shuffled order, so
        // "ข้อ 5" would let students match questions with each other.
        prompt: q.prompt,
        points: 1,
        order: q.num,
        options: {
          create: optionsData,
        },
      },
    });
  }

  console.log(`Successfully seeded ${QUESTIONS.length} questions into exam "${exam.title}"!`);
}

main()
  .catch((e) => {
    console.error("Error in seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
