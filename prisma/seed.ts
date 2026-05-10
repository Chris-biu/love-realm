import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.message.deleteMany();
  await prisma.relationshipState.deleteMany();
  await prisma.memorySummary.deleteMany();
  await prisma.sceneState.deleteMany();
  await prisma.session.deleteMany();
  await prisma.character.deleteMany();
  await prisma.world.deleteMany();

  const world = await prisma.world.create({
    data: {
      slug: "moonlit-residence",
      name: "月栖公馆",
      description:
        "一座位于海边旧城区的复合式公馆，住着彼此牵扯不清的年轻人。夜色、债务、秘密与暧昧在这里缓慢发酵。",
      premise:
        "玩家以新任代管人的身份进入月栖公馆，需要与住客周旋、建立关系，并逐步揭开公馆背后的利益纠葛与个人秘密。",
      storyGuide:
        "整体基调偏细腻、克制、带轻微悬疑。回复要兼顾叙事推进、角色对话与情绪变化，始终围绕恋爱互动叙事展开。",
      defaultScene: "黄昏时分的公馆一层餐厅，窗外有海风，桌上还放着没来得及收拾的晚餐。",
      defaultTime: "第 1 天，18:40",
      initialMemory:
        "玩家今天刚接手公馆，住客们对这位新任代管人仍在观望，彼此礼貌但并不真正信任。",
      statusMetrics: [
        { key: "trust", label: "信任" },
        { key: "affection", label: "好感" },
        { key: "tension", label: "紧张" },
        { key: "curiosity", label: "好奇" },
      ],
    },
  });

  await prisma.character.createMany({
    data: [
      {
        worldId: world.id,
        slug: "lin_yue",
        name: "林月",
        gender: "女",
        roleLabel: "账目负责人",
        publicSummary:
          "冷静克制，负责公馆财务与外部往来，对细节异常敏感，说话总像已经比别人多想了一步。",
        secretSummary:
          "她在暗中调查公馆前任代管人失踪的原因，对玩家既试探又保持戒备。",
        personalityTags: ["理性", "谨慎", "外冷内热"],
        initialMetrics: {
          trust: 0,
          affection: 0,
          tension: 1,
          curiosity: 2,
        },
      },
      {
        worldId: world.id,
        slug: "gu_chen",
        name: "顾辰",
        gender: "男",
        roleLabel: "常驻住客",
        publicSummary:
          "表面散漫，喜欢半夜弹琴，擅长把玩笑说得像真心话，是公馆里最会制造轻松气氛的人。",
        secretSummary:
          "他与前任代管人关系密切，知道不少旧事，但只有在确认玩家立场后才会透露。",
        personalityTags: ["风趣", "试探", "敏锐"],
        initialMetrics: {
          trust: 1,
          affection: 0,
          tension: 0,
          curiosity: 1,
        },
      },
      {
        worldId: world.id,
        slug: "su_ya",
        name: "苏娅",
        gender: "女",
        roleLabel: "甜品师",
        publicSummary:
          "负责公馆餐饮，待人温和，擅长观察情绪变化，总能在微妙时刻打圆场。",
        secretSummary:
          "她隐约知道每个人都在隐瞒什么，也比外表看起来更懂得如何操纵局面。",
        personalityTags: ["温柔", "圆融", "心思细密"],
        initialMetrics: {
          trust: 1,
          affection: 1,
          tension: 0,
          curiosity: 1,
        },
      },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
