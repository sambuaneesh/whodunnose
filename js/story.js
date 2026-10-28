'use strict';
// Season one: one week at Thornbury Tower, and a wedding in the middle of it.
// Every campaign case is authored here: who did it and why, why they lie, where people stood, what the
// witnesses saw, and what happens next. Each case plants something the next one pays off:
//   Mon  Chad's shake        -> Thornbury cancels Dana's potluck and caters lunch himself; Josh fetches it
//   Wed  Josh ate the knots  -> Josh gets paid; Dana starts a juice cleanse for her wedding dress
//   Fri  Dana broke the cleanse -> Dana invites "the nose" to her wedding rehearsal
//   Sat  Brittany's sponsored quiche -> Mrs. Pemberton decides you are trouble; the rehearsal video goes viral
//   Sat  Mrs. Pemberton refused Edna's eggs -> the families make peace; Gary sends the couple home with chili
//   Mon  Thornbury ate the chili he banned -> the potluck returns; you get a job title
// `fix` pins the mystery (see Case.generate); `say` overrides voice lines for this case only ({food} and
// {zone} still fill in); `guilty` in `say` is the culprit's confession.
const SEASON = {
  title: 'Season One: Thornbury Tower',
  tagline: 'One week. One very small elevator. One wedding. Six cases.',
};

const STORY = {
  c1: {
    when: 'Monday', time: '12:52 PM',
    previously: 'Your first day as a junior analyst at Thornbury & Partners, thirtieth floor. Dana from HR gave you a lanyard, a forty-page handbook and a plate from her famous Monday potluck. Now the floor is riding down to Mr. Thornbury\'s all-hands in the lobby: four colleagues you met an hour ago, and one very small box.',
    intro: 'Monday, 12:52. Your first ride down with your new colleagues. Everyone faces the doors.',
    roles: { thornbury: 'CEO. Owns the building.', dana: 'HR. Runs the Monday potluck.', josh: 'Intern. Unpaid. Carrying six coffees.', chad: 'Sales. Just did legs.' },
    fix: {
      culprit: 'chad', food: 'shake', fartType: 'sbd', origin: 'middle', nearDecoy: 'josh', soleEater: true,
      meals: { thornbury: 'tuna', dana: 'eggs', josh: 'garlic' }, pins: { thornbury: 'backright' },
    },
    say: {
      thornbury: { hello: 'You are the new one. Analyst. I never forget a face. I forget every name.', breakfast: '{food}. From the executive kitchen. I do not eat potluck. Nobody knows where potluck has been.' },
      dana: { hello: 'Hi again! First day going okay? Did you get a plate? I make the deviled eggs every Monday. Fourteen years.', breakfast: 'My own {food}, of course. Somebody has to eat them.' },
      josh: { hello: "Hey! New person! Want a coffee? They're for marketing. Marketing won't notice. Marketing never notices me.", breakfast: "{food}! Leftovers from the potluck. Everybody's leftovers. I'm not paid, so I'm basically a raccoon with a lanyard." },
      chad: { hello: "Sup, new hire. Chad. Sales. Leg day, so don't ask me to bend.", breakfast: "{food}, bro. Potluck isn't in my macros.", guilty: "Okay, that was me, bro. It's not a fart. It's gains leaving the body." },
    },
    truth: 'Chad skipped Dana\'s potluck because it "isn\'t in his macros" and drank a double-scoop vanilla protein shake at his desk instead. Protein powder means sulfur, and sulfur means a silent, vanilla-scented cloud right in the middle of the car. Chad was not hiding anything. He just assumed nobody would notice.',
    next: 'At the all-hands, Mr. Thornbury cancels the Monday potluck "for reasons of air quality". From now on he will cater lunch himself. Dana writes something in her binder and does not look up. Josh is put in charge of collecting the food.',
  },

  c2: {
    when: 'Wednesday', time: '5:04 PM',
    previously: 'Mr. Thornbury replaced the potluck with a catered working lunch from the deli downstairs, and sent Josh to collect it. The order arrived four garlic knots short. Nobody has said anything, but Mr. Thornbury has been counting. Now it is five o\'clock and the whole floor is squeezing in to go home, plus Priya from Accounts, back early from leave because daycare closed, plus her son.',
    intro: 'Wednesday, 5:04 PM. Rush hour. Everyone is going home, and everyone is very close together.',
    roles: { thornbury: 'CEO. Ordered twelve garlic knots.', dana: 'HR. On a pre-wedding cleanse.', josh: 'Intern. Collected the lunch order.', chad: 'Sales. Still blamed for Monday.', priya: 'Accounts. Back early from leave.', leo: "Priya's son. Daycare is closed." },
    fix: {
      culprit: 'josh', food: 'garlic', claim: 'tuna', fartType: 'squeaker', origin: 'frontleft', nearDecoy: 'chad', foodDecoy: 'thornbury',
      meals: { dana: 'broccoli', chad: 'shake', priya: 'eggs' }, pins: { thornbury: 'backright' },
      bags: {
        josh: "a phone charger with no phone, the deli receipt for Mr. Thornbury's order (12 garlic knots), and a greasy paper bag of garlic-knot crumbs.",
        thornbury: 'stock reports, a gold pen, and a deli box holding eight garlic knots. The label says twelve.',
      },
    },
    say: {
      thornbury: { hello: 'Someone in this building has been eating my garlic knots. I ordered twelve. TWELVE.', breakfast: 'My {food}. All eight of them. I ordered twelve.' },
      dana: { hello: "Hi! Just so you know, I'm on a cleanse until the wedding. If I faint, I'm fine.", breakfast: "{food}. It's the only solid food on the cleanse plan. It is barely food." },
      josh: { hello: "Hey! Hi! Long day! Super normal day! I didn't go near the deli. I mean, I went to the deli, that was my job, but I didn't... Coffee?", breakfast: '{food}! From home! I brought it from home. In a bag. From my home.', guilty: "Okay, it was me! I ate four of the garlic knots on the way up! I haven't had lunch money since June! I'm UNPAID!" },
      chad: { hello: "Bro. Everybody's been looking at me since Monday. One time, bro. ONE time.", breakfast: '{food}. Same as always. Consistency is gains.' },
      priya: { hello: 'Hi. Sorry about the stroller. Daycare had a lice thing. Is it still Tuesday?', breakfast: '{food}, from the catered lunch. One-handed. Like a raccoon.' },
    },
    truth: 'Josh collected Mr. Thornbury\'s catered lunch and ate four garlic knots in the stairwell, because unpaid interns do not get lunch. Admitting what he ate meant admitting where he got it, so he said "a tuna melt, from home" and hoped nobody would check his backpack. Mr. Thornbury had garlic knots too, all eight of them, but he was in his back corner, across the car from where it started.',
    next: 'Mr. Thornbury does not fire Josh. He starts paying him, "so that this never happens again". Josh cries in the lobby. Meanwhile Dana announces that Friday is her last day before the wedding, and that she has been on a juice cleanse all week to fit into the dress. She looks extremely hungry.',
  },

  c3: {
    when: 'Friday', time: '4:47 PM',
    previously: 'Dana\'s last day before her wedding. Her send-off upstairs had a cake she could not eat, because of the cleanse, and a plate of deviled eggs she made "for everyone else". By the end of the party the plate was empty and Dana was very quiet. Now everyone is going home. On twenty-two, Sal from the pizza place gets on, like every Friday. And like every day, the car will stop at floor nine for nobody.',
    intro: "Friday, 4:47 PM. Dana's last day before the wedding. Everyone is going home.",
    roles: { thornbury: 'CEO. Has sent memos about floor nine.', dana: 'HR. Getting married tomorrow.', josh: 'Intern. Paid now.', chad: 'Sales.', sal: 'Pizza delivery. Gets on at twenty-two.', priya: 'Accounts. Daycare is still closed.', leo: "Priya's son." },
    fix: {
      culprit: 'dana', food: 'eggs', claim: 'broccoli', fartType: 'sbd', origin: 'buttons', nearDecoy: 'josh', foodDecoy: 'priya', witness: 'sal',
      meals: { thornbury: 'tuna', josh: 'garlic', chad: 'shake' }, pins: { thornbury: 'backright' },
      facts: {
        witness: 'I was up on thirty an hour ago with a pizza for the party. The HR lady was eating deviled eggs out of the office fridge. With her hands. She saw me see her.',
        zone: 'Josh was right by the buttons when it started. He presses them for everybody. Nobody asked him to.',
        meal: "Priya had deviled eggs too, at the party. She says they're the only food you can eat one-handed.",
        culpritZone: 'Dana was by the button panel the whole ride. She holds the door-close button. Every time. On principle.',
      },
    },
    say: {
      thornbury: { gossipNone: 'Floor nine is Accounting. They call the elevator, lose patience and take the stairs. Every single day. I have sent memos.' },
      dana: { hello: "Hi! Last day! I'm fine. I'm on a cleanse. I'm very, very fine.", breakfast: "A tiny slice of {food}. It's on the cleanse plan. It's basically a salad.", where: 'By the {zone}. I hold the door-close button. It saves everyone four seconds.', gossipNone: 'Off the record? Tomorrow I marry Brad Pemberton, and his mother has already sent me a list of my flaws. It was laminated.', guilty: "Okay! It was me! Six deviled eggs after five days of juice! I WROTE the odour policy! Please, please do not tell anyone before the wedding." },
      josh: { hello: "Hey! I'm getting PAID now! Real money! I bought my own garlic knots!", breakfast: '{food}! I bought them! With MONEY!', gossipNone: 'Why does this thing stop at nine every day? Nobody ever gets on at nine.' },
      chad: { gossipNone: 'Bro, the HR lady has been staring at my shaker all week like it owes her money.' },
      sal: { hello: 'Pizza for the lobby! Guy down there orders every Friday. Never tips. I keep coming back. I don\'t know why.' },
      priya: { hello: "Hi. Daycare's still closed, so Leo came to Dana's party. He was the only one who had fun.", breakfast: '{food}, at the party. The only food you can eat one-handed.' },
    },
    truth: 'Dana spent the week on a juice cleanse to fit into her wedding dress. At her own send-off she made deviled eggs "for everyone else", then ate six of them out of the fridge when she thought nobody was looking. Sal was. Five days of juice plus six eggs is a lot of sulfur, released silently beside the door-close button she always holds. She claimed quiche because the head of HR, author of the office odour policy, could not admit to this one.',
    next: 'When the doors open, Dana pulls you aside. "You have a nose," she says. "Tomorrow my future mother-in-law and Uncle Gary will be in one room, with food. I need someone at the rehearsal who can handle things." She hands you an invitation. It is laminated.',
  },

  c4: {
    when: 'Saturday', time: '9:30 AM', clock: [9, 30], youAre: "Dana's elevator friend",
    previously: 'St. Swithin\'s Chapel. Dana and Brad get married at eleven. Mrs. Pemberton, the groom\'s mother, insisted on a rehearsal the same morning "so nobody forgets anything". Dana is at the hairdresser and has left you in charge of keeping the peace. Brittany, the maid of honour, is livestreaming. Uncle Gary brought a cooler of his famous chili and made you eat two bowls. You are starting to regret the second one.',
    intro: "Saturday, 9:30 AM. The rehearsal. The bride is at the hairdresser, so you're in charge.",
    roles: { mulligan: 'Officiant.', gary: "Groom's uncle. Brought a cooler of chili.", brittany: "Maid of honour. Livestreaming.", brad: 'The groom. Sweating.', pemberton: "Groom's mother. Judges everyone.", kevin: 'Photographer. Hired off a forum.', biscuit: "Brad's dog. Ring dog." },
    fix: {
      culprit: 'brittany', food: 'broccoli', claim: 'garlic', fartType: 'squeaker', origin: 'flowers', nearDecoy: 'pemberton', foodDecoy: 'kevin', witness: 'gary', cover: 'arms',
      meals: { gary: 'chili', brad: 'eggs', mulligan: 'tuna', pemberton: 'tuna' }, pins: { brad: 'altar', gary: 'back' }, // she always has the tuna melt (c5)
      facts: {
        witness: 'Brittany ate a whole green quiche on her livestream. "Gut Glow, zero bloat, link in bio." Zero bloat, my foot.',
        zone: 'Mrs. Pemberton was at the flower stand when it started, telling the florist everything that was wrong with it. Long list.',
        meal: 'The photographer has been eating quiche off the brunch table. Three slices. He says it is "part of his rate".',
        culpritZone: 'Brittany was over by the flowers doing her content. She says the light there is "a moment".',
      },
    },
    say: {
      brittany: { hello: "Oh my god, hi, you're Dana's elevator friend! Can you move? You're in my light. Thanks, babe.", breakfast: "One {food}. For the content. I don't really eat carbs on camera.", gossipNone: 'Brad\'s mom asked if my dress was "a costume". On my live. I have forty thousand witnesses.', guilty: 'Okay, fine, it was me! Gut Glow pays me two thousand dollars a post to say their quiche causes "zero bloat"! Stop filming. Who is filming? KEVIN!' },
      gary: { hello: "Hey hey! The elevator kid! Dana says you've got a nose. How was the chili? Have a third bowl!", breakfast: '{food}, baby! My own recipe! Three beans, no mercy!' },
      pemberton: { hello: "And you are...? Ah. The bride's elevator person. She brought a detective to her own rehearsal. That explains a great deal." },
      brad: { hello: "Hey! Hi! You're Dana's friend! She says you're good at finding things out. Please don't find anything out about me. I'm fine.", gossipNone: "My mom and Dana's grandma haven't spoken since the engagement party. Something about eggs." },
      kevin: { hello: 'Kevin. Photographer. Brad found me on a forum. Five stars. Well, one review. It was my mom.', breakfast: '{food}, man. Free brunch is part of my rate.' },
      mulligan: { hello: 'Bless you, child. Rehearsals are where weddings go to die, so that weddings may live.', gossipNone: 'Mrs. Pemberton has asked me twice whether the bride is "definitely sure". I told her the Lord does not do refunds.' },
    },
    truth: 'Brittany is paid to tell forty thousand followers that Gut Glow Green Quiche causes "zero bloat". She ate a whole one live this morning by the flower stand, where the light is good, and broccoli did what broccoli does. Admitting it on her own livestream would cost her the sponsorship, so she claimed a single garlic knot and loudly praised the lilies whenever anyone came close. Kevin had eaten the quiche too, but from across the chapel by the organ.',
    next: 'The rehearsal survives. Mrs. Pemberton does not forgive you for "making a scene" and tells everyone that the bride\'s elevator person is not to be trusted. She will be watching you at the ceremony. Meanwhile, Uncle Gary has taken more chili to the vestry and insists you have a bowl before the ceremony. You have a bowl.',
  },

  c5: {
    when: 'Saturday', time: '10:58 AM',
    previously: 'The ceremony. Dana\'s grandmother Edna, ninety-one, has brought her deviled eggs (same recipe since 1962) and offered them to everyone. Mrs. Pemberton refused them three times, loudly. The two have not spoken since the engagement party. Little Timmy has the rings. Kevin has his camera. You have had Gary\'s chili twice today, and Mrs. Pemberton has not taken her eyes off you.',
    intro: "Saturday, 10:58 AM. St. Swithin's Chapel. Dana and Brad's wedding starts any minute. Mingle.",
    youAre: 'the elevator person',
    roles: { edna: "Bride's grandmother, 91. Brought eggs.", timmy: "Ring bearer, age 7. Brad's nephew.", pemberton: "Groom's mother. Watching you.", brittany: 'Maid of honour. Off sponsorships.', gary: "Groom's uncle. Still has chili." },
    fix: {
      culprit: 'pemberton', food: 'tuna', claim: 'eggs', fartType: 'sbd', origin: 'rightpews', nearDecoy: 'edna', foodDecoy: 'mulligan', witness: 'timmy', cover: 'blamedog',
      meals: { edna: 'eggs', gary: 'chili', brittany: 'broccoli', brad: 'garlic', kevin: 'eggs' }, pins: { gary: 'back', brad: 'altar' },
      facts: {
        witness: 'Grandma Pemberton ate a fishy sandwich in the car and said not to tell anyone. It smelled like the aquarium.',
        zone: "Grandma Edna was over on the groom's side when it started, arguing with Mrs. Pemberton about eggs.",
        meal: 'Father Mulligan had a tuna melt in the vestry. Fish on Friday, leftovers on Saturday, he says.',
        culpritZone: "Mrs. Pemberton was guarding the front of the groom's side. Nobody sits in the Pemberton pew without permission.",
      },
    },
    say: {
      pemberton: { hello: 'You again. I am watching you, elevator person. Do not ruin my son\'s wedding.', breakfast: "I had one of Edna's {food}. To be polite. It was adequate.", where: 'On the groom\'s side, by the {zone}. Where Pembertons sit.', gossipNone: "That woman's eggs have been sitting in a cooler since Wednesday. I would sooner eat the dog.", guilty: 'FINE. It was me. I had a tuna melt in the car because I was NOT going to eat that woman\'s eggs. Do you hear me, Edna? NOT YOUR EGGS.' },
      edna: { hello: "EH? Oh, you're Dana's friend from the elevator! Have a deviled egg! Same recipe since 1962!", breakfast: '{food}, dear! My OWN! Everyone loves them except HER.', gossipNone: 'SHE REFUSED MY EGGS. THREE TIMES. IN FRONT OF THE FLORIST.' },
      timmy: { hello: "I'm the ring bearer. Uncle Brad is my uncle. The rings are in my shoe. Don't tell." },
      brittany: { hello: 'Oh my god, it\'s you. My rehearsal live got two million views. Everyone\'s calling you "the Nose". Thanks, I guess?', breakfast: "{food}. I'm off sponsorships for a while." },
      gary: { hello: 'The elevator kid! Another bowl? You look a little green, pal.', breakfast: "{food}! Gary's famous! I'm sending a whole cooler home with the newlyweds!" },
      mulligan: { breakfast: '{food}. Fish on Friday, leftovers on Saturday. The Lord appreciates thrift.' },
      brad: { hello: "It's happening. It's actually happening. If anything smells weird today, please just... fix it. Dana says you fix things." },
      kevin: { hello: 'Hey, the Nose! I got great shots of you at the rehearsal. Mostly sniffing.' },
    },
    truth: 'Mrs. Pemberton refused Edna\'s deviled eggs three times in public, so she could not be seen eating anything Edna had touched. She ate a tuna melt in the car on the way, in secret, and told Timmy not to tell. Timmy told. In the front pew on the groom\'s side, with Edna arguing next to her, the tuna went off silently. So she said she had eaten one of Edna\'s eggs, which put the smell on her enemy, and loudly blamed the dog.',
    next: 'Edna hears every word. "NOT MY EGGS?" There is a long silence. Then both grandmothers start laughing, and do not stop for most of the vows. Dana and Brad are married. Brittany posts the whole thing, and by Sunday night two million strangers know you as "the Nose", including everyone at Thornbury Tower. Gary sends the newlyweds home with a cooler of leftover chili.',
  },

  c6: {
    when: 'Monday', time: '12:52 PM',
    previously: 'One week after your first day. Dana is back for one day before the honeymoon, and has brought Gary\'s leftover wedding chili to revive the Monday potluck. Mr. Thornbury, who cancelled the potluck, announced that he would "not touch it". Everyone in the building has seen the video. You are the Nose. Someone in this car knows it, and would very much like the Nose to take the blame.',
    intro: 'Monday, 12:52 PM. One week later. Floor 30. Everyone has seen the video.',
    youAre: 'the Nose',
    roles: { thornbury: 'CEO. Cancelled the potluck.', dana: 'HR. Married on Saturday. Brought the chili.', josh: 'Intern. Paid now.', chad: 'Sales. Bulking season.', sal: 'Pizza delivery. Saw the video.', priya: 'Accounts. Leo is teething.', leo: "Priya's son." },
    fix: {
      culprit: 'thornbury', food: 'chili', claim: 'tuna', fartType: 'trumpet', origin: 'backright', nearDecoy: 'josh', foodDecoy: 'chad', witness: 'sal', cover: 'arms', framesYou: true,
      meals: { dana: 'broccoli', priya: 'eggs', josh: 'garlic' },
      facts: {
        witness: 'I brought pizza up to thirty for the potluck. Your big boss was at the chili pot with a ladle. Third bowl. He said "you did not see this". I saw this.',
        zone: 'Josh was in the back right corner with Mr. Thornbury when it started, holding everybody\'s coffees as usual.',
        meal: 'Chad had the chili. Two bowls. He says it\'s bulking season and beans are "nature\'s protein".',
        culpritZone: 'Mr. Thornbury was in his corner. Back right. He always says it is his corner.',
      },
    },
    say: {
      thornbury: { hello: 'Ah. The famous Nose. I have seen the video. Twice. My nephew sent it to me.', breakfast: '{food}. From the executive kitchen. I did not touch the chili. Nobody saw me touch the chili.', gossipNone: 'Some people in this car are saying it was you. I have no idea where they heard that.', guilty: 'All right! It was me! Three bowls! I cancelled the potluck and then I ATE the potluck! I own this elevator!' },
      dana: { hello: "Hi! Married! Flying out tomorrow. I brought Gary's leftover chili for the potluck. All of it. Please eat it. Please.", breakfast: '{food}. I cannot look at chili. I have had chili for three days.', gossipNone: 'Officially, HR does not recognise "the Nose" as a job title. Unofficially, four departments have asked for you.' },
      josh: { hello: "Hey! It's the Nose! I'm paid now, so technically I can afford to be framed for things.", breakfast: "{food}! Bought with my own money! I'm a man of means!" },
      chad: { hello: 'Bro. The Nose. You\'re famous, bro. Selfie later?', breakfast: '{food}, bro. Bulking season. Beans are nature\'s protein.' },
      sal: { hello: "Hey, it's the Nose! My cousin sent me the video. Pizza for the lobby, as usual." },
      priya: { hello: "Hi. Leo's teething. I've watched your video eleven times. It's the only thing that makes him stop crying." },
    },
    truth: 'Mr. Thornbury cancelled the potluck a week ago for "air quality". When Dana brought Gary\'s leftover wedding chili, he said he would not touch it, then had three bowls when he thought nobody was looking. Sal was. Beans make a lot of gas, which is why it was loud, from his own back right corner. The CEO could not be caught breaking his own rule in front of the building\'s famous Nose, so he claimed a tuna melt, changed the subject to the quarterly numbers, and whispered to anyone who would listen that it was you.',
    next: 'In the lobby, Mr. Thornbury clears his throat and announces that the Monday potluck is back, effective immediately. Josh gets a desk. Dana leaves for her honeymoon. And you get a new job title, printed on a laminated card: Head of Air Quality.',
    finale: true,
  },
};

CASES.forEach((c) => { c.story = STORY[c.id] || null; });
