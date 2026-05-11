import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MINIMUM_REPLY_LENGTH } from "./config";
import { parseNarrativeTurn } from "./story-schema";

function makeLongReply(length = DEFAULT_MINIMUM_REPLY_LENGTH) {
  const seed = "夜色沿着窗棂慢慢压进房间，人物的呼吸、沉默、试探和未说出口的心意在灯下交错。";
  return seed.repeat(Math.ceil(length / seed.length));
}

test("默认要求 visibleReply 不少于 3000 字并保留 3 个剧情建议", () => {
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
  assert.ok(parsed.visibleReply.length >= DEFAULT_MINIMUM_REPLY_LENGTH);
});

test("visibleReply 少于默认最低字数时解析失败", () => {
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

test("自定义最低字数会覆盖默认校验", () => {
  const minimumReplyLength = 600;
  const parsed = parseNarrativeTurn(
    JSON.stringify({
      visibleReply: makeLongReply(minimumReplyLength),
      hiddenStateUpdate: {
        relationshipChanges: {},
        sceneChanges: [],
        newFacts: [],
        memorySummary: "",
        suggestedActions: ["继续追问", "沉默观察", "主动示好"],
      },
    }),
    { minimumReplyLength },
  );

  assert.ok(parsed.visibleReply.length >= minimumReplyLength);
});
