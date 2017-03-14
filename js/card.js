const Combinatorics = require('./lib/js-combinatorics');
const __ = require('./lib/underscore');

const SuitType = {
  Spade: 0,
  Heart: 1,
  Diamond: 2,
  Club: 3,
} 

const RankName = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K'
}

const SuitName = {};
SuitName[SuitType.Spade] = 'Sp';
SuitName[SuitType.Heart] = 'He';
SuitName[SuitType.Diamond] = 'Di';
SuitName[SuitType.Club] = 'Cl';

const MinimumRank = 1;
const SuitCount = Object.keys(SuitType).length;
const RankCount = Object.keys(RankName).length;
const HandCardCount = 5;
const CommunityCardCount = 5;
const HoldsCardCount = 2;
const PlayerCount  = 10;
// 役の名前と条件
const HandConditions = [
{
  name: 'High Card',
  check: (_) => true
},
{
  name: 'One Pair',
  check: (_) => _.groupCounts[2] == 1
},
{
  name: 'Two Pair',
  check: (_) => _.groupCounts[2] == 2
},
{
  name: 'Three of a Kind',
  check: (_) => _.groupCounts[3] == 1
},
{
  name: 'Straight',
  check: (_) => _.isStraight
},
{
  name: 'Flush',
  check: (_) => _.isFlush
},
{
  name: 'Full House',
  check: (_) => _.groupCounts[3] == 1 && _.groupCounts[2] == 1
},
{
  name: 'Four of a Kind',
  check: (_) => _.groupCounts[4] == 1
},
{
  name: 'Straight Flush',
  check: (_) => _.isStraight && _.isFlush
},
{
  name: 'Five of a Kind',
  check: (_) => _.groupCounts[5] == 1
}
];

// 役判定ロジック
class HandChecker {
  constructor(hand) {
    this.hand = hand;
    this.hand.sort((a,b) => a.pokerRank() - b.pokerRank());

    // ペア系判定
    {
      // ランクごとのカード枚数
      this.rankNums = [];
      for(let i = 0;i <= RankCount + 1; ++i) {
        this.rankNums[i] = 0;
      }
      this.hand.forEach(card => ++this.rankNums[card.pokerRank()]);
      // n枚のペアの数
      this.groupCounts = [];
      this.groupRanks = [];
      for(let i = 0;i <= HandCardCount; ++i) {
        this.groupCounts[i] = 0;
        this.groupRanks[i] = [];
      }

      this.rankNums.forEach((groupCount, index) => {
        if (groupCount > 0) {
          ++this.groupCounts[groupCount];
          this.groupRanks[groupCount].push(index);
        }});
      // グループ内, 強い順にソート
      this.groupRanks.forEach(groupRank => groupRank.sort((a,b) => b - a));
    }

    // ストレート系判定
    {
      let isStraight = false;
      if (this.groupCounts[1] == HandCardCount) {
        // 重複するペアがない
        if (this.hand[HandCardCount - 1] - this.hand[0] === HandCardCount - 4) {
          // 最大ランクと最少ランクの差が4
          let isStraight = true;
        }
        else if (this.hand[HandCardCount - 1].rank == 1 && this.hand[HandCardCount - 2] == 4){
          // 最大ランクが1で2番目に大きいランクが4
          // →A,2,3,4,5 
          let isStraight = true;
          // Aが最弱として扱われる
          this.hand.sort((a,b) => a.rank - b.rank);
        }
      }
      this.isStraight = isStraight;
    }

    // フラッシュ系判定
    // すべてのスートが同じ
    this.isFlush = hand.every(card => card.suit == hand[0].suit);
    this.handRank = __(HandConditions).findLastIndex((e) => e.check(this));
    // カードランク評価順
    // ストレート: 最上位カードを比較
    // その他: 最も枚数の多いカードグループから順に位を比較
    this.rankEvaluateOrder = this.isStraight
      ? this.hand.concat().reverse()
      : __(this.groupRanks.concat().reverse()).flatten();
  }

  // ハンド同士の比較関数
  static compare(left, right) {
    if (left.handRank != right.handRank) {
      // 役の強さが異なる
      return left.handRank - right.handRank;
    }
    else {
      // カードの強さで比較
      let diffIndex = left.rankEvaluateOrder.findIndex((e, i) => e != right.rankEvaluateOrder[i]);
      return diffIndex < 0 ? 0 : left.rankEvaluateOrder[diffIndex] - right.rankEvaluateOrder[diffIndex];
    } 
  }
}

// ７枚のカードによる役
class SevenHand {
  constructor(holds, communities) {
    let cards = communities.concat(holds);
    let comb = Combinatorics.combination(cards, 5);
    let hand;
    let bestHandChecker;
    while(hand = comb.next()){
      let handChecker = new HandChecker(hand);
      if (bestHandChecker == null) {
        bestHandChecker = handChecker;
        continue;
      }
      if (HandChecker.compare(handChecker, bestHandChecker) > 0) {
        bestHandChecker = handChecker;
      }
    }
    this.bestHandChecker = bestHandChecker;
    this.bestHand = bestHandChecker.hand;
    this.bestHandName = HandConditions[this.bestHandChecker.handRank].name;
  }
}

class Card {
  constructor(suit, rank) {
    this.suit = suit;
    this.rank = rank;
  }

  // Aが最も強い、ポーカーの一般の役でのカードの強さ
  pokerRank() {
    return this.rank == 1 ? 14 : this.rank; 
  }

  toString() {
     return ""+SuitName[this.suit]+RankName[this.rank];
   }
}

class Player {
  constructor(id) {
    this.id = id;
    this.holds = [];
    this.chip = 3000;
    this.isWin = false;
  }

  checkHand(communities) {
    this.hand = new SevenHand(this.holds, communities);
  }
}

class Poker {
  constructor() {
    this.stack = [];

    for (let suit = 0; suit < SuitCount; ++suit) {
      for (let i = 0, rank = MinimumRank; i < RankCount; ++i, ++rank) {
        this.stack.push(new Card(suit, rank));
      }
    }

    this.stack = __(this.stack).shuffle();
    this.communities = [];
    for (let i = 0; i < CommunityCardCount; ++i) {
      this.communities.push(this.stack.pop());
    }
    this.players = [];
    for (let i = 0; i < PlayerCount; ++i) {
      let player = new Player(i + 1);
      for (let j = 0; j < HoldsCardCount; ++j) {
        player.holds.push(this.stack.pop());
      }
      player.checkHand(this.communities);
      this.players.push(player);
    }

    let winners = this.players.map((player) => ({e: player, comp: player.hand.bestHandChecker}))
      .sort((a,b) => -HandChecker.compare(a.comp, b.comp))
      .filter((e,i,arr) => HandChecker.compare(e.comp, arr[0].comp) === 0)
      .map((_) => _.e);
    winners.forEach((player) => player.isWin = true);

    console.log(this.communities.map(card => card.toString()).join(' '));
    console.log();
    this.players.forEach(player => {
      console.log("Player"+player.id+":" + (player.isWin ? ' [WIN]' : ''));
      console.log(player.holds.map(card => card.toString()).join(' '));
      console.log(player.hand.bestHandName);
      console.log();
    })
  }
} 

let poker = new Poker(); 
