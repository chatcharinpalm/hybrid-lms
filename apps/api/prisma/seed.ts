import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@netsechub.dev" },
    update: {},
    create: {
      email: "admin@netsechub.dev",
      passwordHash,
      firstName: "ผู้ดูแล",
      lastName: "ระบบ",
      fullName: "ผู้ดูแลระบบ",
      role: "ADMIN",
    },
  });
  void admin;

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@netsechub.dev" },
    update: {},
    create: {
      email: "teacher@netsechub.dev",
      passwordHash,
      firstName: "นครินทร์",
      lastName: "เกียรติศิริกุล",
      fullName: "อ.ดร. นครินทร์ เกียรติศิริกุล",
      role: "TEACHER",
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "student@netsechub.dev" },
    update: {},
    create: {
      email: "student@netsechub.dev",
      passwordHash,
      firstName: "สมชาย",
      lastName: "ใจดี",
      fullName: "สมชาย ใจดี",
      role: "STUDENT",
      studentCode: "CPE-64-001",
      faculty: "วิศวกรรมศาสตร์",
      major: "วิศวกรรมคอมพิวเตอร์",
    },
  });

  const course = await prisma.course.upsert({
    where: { code: "CPE-321" },
    update: {},
    create: {
      code: "CPE-321",
      title: "Network Architecture & Cyber Defense",
      description: "Defense-in-depth network security and incident response",
      termLabel: "2/2567",
      teacherId: teacher.id,
    },
  });

  await prisma.enrollment.upsert({
    where: { courseId_studentId: { courseId: course.id, studentId: student.id } },
    update: {},
    create: { courseId: course.id, studentId: student.id },
  });

  const session = await prisma.classSession.create({
    data: {
      courseId: course.id,
      title: "Week 8: Stateful Inspection Firewalls",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      onsiteRoom: "Building 402",
      onlineJoinUrl: "https://meet.example.com/cpe-321-w08",
      qrSecret: "seed-qr-secret-change-me",
    },
  });
  void session;

  const exam = await prisma.exam.create({
    data: {
      courseId: course.id,
      title: "Midterm: Network Hardening & Perimeter Defense",
      description: "Subnetting, firewall policy, and packet analysis",
      durationMinutes: 60,
      passScorePercent: 70,
      maxAttempts: 2,
      status: "OPEN",
      requireFullscreen: true,
      blockClipboard: true,
      blockContextMenu: true,
      maxViolations: 3,
      shuffleQuestions: true,
      shuffleOptions: true,
      questions: {
        create: [
          {
            type: "SINGLE_CHOICE",
            prompt: "ข้อใดคือ Subnet Mask ของ /26?",
            points: 10,
            order: 0,
            options: {
              create: [
                { label: "255.255.255.0", isCorrect: false, order: 0 },
                { label: "255.255.255.192", isCorrect: true, order: 1 },
                { label: "255.255.255.224", isCorrect: false, order: 2 },
                { label: "255.255.255.128", isCorrect: false, order: 3 },
              ],
            },
          },
          {
            type: "MULTIPLE_CHOICE",
            prompt: "ข้อใดต่อไปนี้เป็น Stateful Firewall (เลือกได้มากกว่า 1 ข้อ)",
            points: 10,
            order: 1,
            options: {
              create: [
                { label: "iptables", isCorrect: true, order: 0 },
                { label: "pfSense", isCorrect: true, order: 1 },
                { label: "Traditional packet-filter ACL router", isCorrect: false, order: 2 },
              ],
            },
          },
          {
            type: "SHORT_ANSWER",
            prompt: "ส่งค่า Flag ที่พบจากการวิเคราะห์ไฟล์แพ็กเก็ต",
            points: 20,
            order: 2,
            answerKey: "flag{example_ctf_answer}",
          },
        ],
      },
    },
  });
  void exam;

  // eslint-disable-next-line no-console
  console.log(
    "Seed complete. Login with admin@netsechub.dev / teacher@netsechub.dev / student@netsechub.dev, password: Password123!"
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
