import assert from "node:assert/strict";
import test from "node:test";
import { parseNarrativeTurn } from "./story-schema";

function makeLongReply() {
  return [
    "夜色沿着窗棂慢慢压进房间，灯影在风里轻轻摇晃，林月没有立刻回答，只把手里的茶盏放回桌面。",
    "她的指尖停在杯沿，像是在压住某种不愿外露的情绪。走廊尽头传来极轻的脚步声，又很快消失，仿佛有人在刻意回避这场对峙。",
    "你能感觉到空气里的温度正在改变，原本勉强维持的平静被一点点拉紧。林月终于抬眼看向你，目光里既有审视，也有一丝被迟归刺痛后的失落。",
    "她低声说，既然你愿意回来，现在是不是也该把昨晚的事说清楚。她的语气并不重，却比任何责问都更让人难以闪躲。",
    "窗外一阵夜风吹动帘角，把屋内安稳的光影切得细碎，也把你们之间那层若即若离的克制撕开一道口子。",
    "顾景的影子停在门缝边缘，像是既想听清，又不愿真正卷进尚未落定的情绪。",
    "苏棠在楼下压低声音吩咐佣人撤走已经冷掉的点心，银盘轻碰的声音像远处落下的雨点，让这座公馆显得更空，也让每一句没有说出口的话都变得更清楚。",
    "你站在灯下，意识到这不是一次普通解释，而是关系重新分配的节点：谁会相信你，谁会怀疑你，谁又会借这个机会靠近你，都将在接下来的回答里慢慢显形。",
  ].join("");
}

test("解析通过时要求 visibleReply 不少于 300 字并保留 3 个剧情建议", () => {
  const parsed = parseNarrativeTurn(
    JSON.stringify({
      visibleReply: makeLongReply(),
      hiddenStateUpdate: {
        relationshipChanges: {
          lin_yue_trust: 1,
        },
        sceneChanges: ["房间里的气氛由克制转向紧绷"],
        newFacts: ["林月在意玩家昨晚迟归"],
        memorySummary: "玩家回到房间后被林月正面追问昨晚去向。",
        currentScene: "月下公馆二层起居室",
        currentTime: "深夜",
        atmosphere: "安静里带着试探与压抑",
        suggestedActions: ["解释昨晚去向", "反问她为何一直等着", "追问门外的脚步声"],
      },
    }),
  );

  assert.equal(parsed.hiddenStateUpdate.suggestedActions.length, 3);
  assert.ok(parsed.visibleReply.length >= 300);
});

test("visibleReply 少于 300 字时解析失败", () => {
  assert.throws(() =>
    parseNarrativeTurn(
      JSON.stringify({
        visibleReply: "她看了你一眼，轻声说今晚的风有点冷。",
        hiddenStateUpdate: {
          relationshipChanges: {},
          sceneChanges: [],
          newFacts: [],
          memorySummary: "",
          suggestedActions: ["继续追问", "沉默观察", "主动示好"],
        },
      }),
    ),
  );
});
