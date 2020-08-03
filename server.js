const ws = require('ws');
var activeGames = {};
const cards = ["NH", "TH","JH","QH","KH","AH","ND","TD","JD","QD","KD","AD","NS","TS","JS","QS","KS","AS","NC","TC","JC", "QC", "KC", "AC"];
const order = ["north", "east", "south", "west"];
const match = {
        D: "H",
        H: "D",
        S: "C",
        C: "S"
      }
const server = new ws.Server({
  port: process.env.PORT,
});
server.on('connection', function connection(client){
  client.on('message', async function incoming(message){
    var data = JSON.parse(message);
    console.log(data);
    switch(data.action){
      case "newGame":
        var gKey = newGame();
        activeGames[gKey].connectedClients.push(client);
        var rData = {action: "newGameResult", key: gKey}
        client.send(JSON.stringify(rData));
        break;
      case "getPlayers":
        var rData = {action: "getPlayersResult", players: getPlayers(data.key)};
        client.send(JSON.stringify(rData));
        break;
      case "joinTeam":
        activeGames[data.key].players[data.team].name = data.name;
        activeGames[data.key].players[data.team].client = client;
        var rData = {action: "getPlayersResult", players: getPlayers(data.key)};
        for (var client2 of activeGames[data.key].connectedClients){
            client2.send(JSON.stringify(rData));
        }
        var allReady = true;
        for (var key in activeGames[data.key].players){
          if (!activeGames[data.key].players[key].client){
            allReady = false;
          }
        }
        if (allReady){
          for (var i=10; i>=0; i--){
            var rData = {action: "gameCountdownMessage", time: i};
            for (var client2 of activeGames[data.key].connectedClients){
                client2.send(JSON.stringify(rData));
            }
            await new Promise(function(resolve, reject){
              setTimeout(resolve, 1000);
            });
          }
          runGame(data.key);
        }
        break;
      case "joinGame":
        var rData;
        console.log(activeGames[data.key])
        activeGames[data.key].connectedClients.push(client);
        if (activeGames[data.key]){
          rData = {action: "joinGameResult", result: true};
          client.send(JSON.stringify(rData));
          return;
        }
        rData = {action: "joinGameResult", result: false};
        client.send(JSON.stringify(rData));
        break;
      case "confirmJoin":
        activeGames[data.key].joins++;
        break;
      case "sendPlay":
        activeGames[data.key].players[data.team].play = data.play;
        break;
    }
  });
});
function newGame(){
  var key = generateToken(8)
  var nGame = {
    key: key,
    joins: 0,
    turn: 0,
    trump: null,
    calledTrump: null,
    lead: null,
    connectedClients: [],
    flip: null,
    players: {
      north: {
        name: "",
        client: null,
        cards: [],
        play: null
      },
      south: {
        name: "",
        client: null,
        cards: [],
        play: null
      },
      east: {
        name: "",
        client: null,
        cards: [],
        play: null
      },
      west: {
        name: "",
        client: null,
        cards: [],
        play: null
      }
    },
    scores: {
      northsouth: 0, 
      eastwest: 0
    },
    rScores: {
      northsouth: 0, 
      eastwest: 0
    },
    dealer: Math.floor(Math.random()*4),
    dealHand: function(){
      var options = cards.slice();
      this.players.north.cards = [];
      this.players.south.cards = [];
      this.players.east.cards = [];
      this.players.west.cards = [];
      var order = ["north", "south", "east", "west"]
      var lIndex = 0;
      for(var i=0;i<20; i++){
        var chosenCard = options.splice(Math.floor(options.length*Math.random()), 1)[0];
        this.players[order[lIndex]].cards.push(chosenCard);
        lIndex++;
        if (lIndex==4){
          lIndex=0;
        }
      }
      this.flip = options.splice(Math.floor(options.length*Math.random()), 1)[0];
    },
    advanceDealer: function(){
      this.dealer++;
      if (this.dealer == 4){
        this.dealer = 0;
      }
    },
    advanceTurn: function(){
      this.turn++;
      if (this.turn == 4){
        this.turn = 0;
      }
    }
  }
  activeGames[key] = nGame;
  return key;
}
function getPlayers(key){
  console.log(key);
  var northName = activeGames[key].players.north.name ? activeGames[key].players.north.name : "Open";
  var southName = activeGames[key].players.south.name ? activeGames[key].players.south.name : "Open";
  var eastName = activeGames[key].players.east.name ? activeGames[key].players.east.name : "Open";
  var westName = activeGames[key].players.west.name ? activeGames[key].players.west.name : "Open";
  var nObject = {north:  northName, south: southName, west: westName, east: eastName};
  return nObject
}
function generateToken(length){
  var tString = "";
  var usableTokenCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
  for (var i=0; i<length; i++){
    tString+=usableTokenCharacters[Math.floor(Math.random() * usableTokenCharacters.length)];
  }
  return tString;
}
async function runGame(key){
  var game = activeGames[key];
  while (true){
    await sleep(500);
    console.log(game.joins);
    if (game.joins == 4){
      break;
    }
  }
  console.log("all players joined");
  while(true){
  game.dealHand();
  for (var player of ["north", "south", "west", "east"]){
    game.players[player].client.send(JSON.stringify({action: "getHandResult", cards: game.players[player].cards}));
    game.players[player].client.send(JSON.stringify({action: "getDealerResult", dealer: order[game.dealer]}));
  }
  game.turn = game.dealer + 1;
  if (game.turn == 4){
    game.turn = 0;
  }
  var someoneCalled = false;
  for (var i=0; i<4; i++){
    for (var player of ["north", "south", "west", "east"]){
      game.players[player].client.send(JSON.stringify({action: "getTurnResult", turn: order[game.turn]}));
    } 
    game.players[order[game.turn]].client.send(JSON.stringify({action: "pickTrump", card: game.flip}));
    while (true){
      await sleep(300);
      if (game.players[order[game.turn]].play == "pass"){
        game.advanceTurn();
        break;
      }
      else if(game.players[order[game.turn]].play == "call"){
        someoneCalled = true;
        game.trump = game.flip.split("")[1];
        for (var player of ["north", "south", "west", "east"]){
          game.players[player].client.send(JSON.stringify({action: "getTrumpResult", trump: game.trump, called: order[game.turn]}));
          game.calledTrump = order[game.turn];
        } 
        break;
      }
    }
    if (someoneCalled == true){
      game.players[order[game.dealer]].play = null;
      for (var player of ["north", "south", "west", "east"]){
        game.players[player].client.send(JSON.stringify({action: "getTurnResult", turn: order[game.dealer]}));
      } 
      game.players[order[game.dealer]].client.send(JSON.stringify({action: "replaceCard", card: game.flip}));
      while (true){
        await sleep(300);
        if (game.players[order[game.dealer]].play){
          for(var xx=0; xx<game.players[order[game.dealer]].cards.length; xx++){
            if (game.players[order[game.dealer]].cards[xx] == game.players[order[game.dealer]].play){
              game.players[order[game.dealer]].cards[xx] = game.flip;
              game.players[order[game.dealer]].client.send(JSON.stringify({action: "getHandResult", cards: game.players[order[game.dealer]].cards}));
            }
          }
          break;
        } 
      }
      break;
    }
  }
  game.turn = game.dealer + 1;
  if (game.turn == 4){
    game.turn = 0;
  }
  for (var player of ["north", "south", "west", "east"]){
    game.players[player].client.send(JSON.stringify({action: "getTurnResult", turn: order[game.turn]}));
    game.players[player].play = null;
  } 
  if (!someoneCalled){
    var secondDone = false;
    for (var i=0; i<4; i++){
      for (var player of ["north", "south", "west", "east"]){
        game.players[player].client.send(JSON.stringify({action: "getTurnResult", turn: order[game.turn]}));
      } 
      game.players[order[game.turn]].client.send(JSON.stringify({action: "pickTrump2", forced: i==3 ? true : false}));
      while (true){
        await sleep(300);
        if (game.players[order[game.turn]].play == "pass"){
          game.advanceTurn();
          break;
        }
        else if(game.players[order[game.turn]].play){
          game.trump = game.players[order[game.turn]].play;
          game.calledTrump = order[game.turn];
          for (var player of ["north", "south", "west", "east"]){
            game.players[player].client.send(JSON.stringify({action: "getTrumpResult", trump: game.trump, called: order[game.turn]}));
          }
          secondDone = true;
          break;
        }
      }
      if (secondDone){
        game.turn = game.dealer + 1;
        if (game.turn == 4){
          game.turn = 0;
        }
        break;
      }
    }
  }
  for (var player of ["north", "south", "west", "east"]){
   // game.players[player].client.send(JSON.stringify({action: "getTrumpResult", trump: game.trump, called: order[game.turn]}));
    game.players[player].client.send(JSON.stringify({action: "getTurnResult", turn: order[game.turn]}));
    game.players[player].client.send(JSON.stringify({action: "roundStarted"}));
    game.players[player].play = null;
  }  
    for(var x=0; x<5; x++){
      for (var i=0; i<4; i++){
        while (true){
          await sleep(300);
          if (game.players[order[game.turn]].play){
            if (i == 0){
              var copyPlay = game.players[order[game.turn]].play;
              if (copyPlay.split("")[0] == "J" & copyPlay.split("")[1] == match[game.trump]){
                copyPlay = copyPlay.split("")[0] + game.trump;
              }
              game.lead = copyPlay.split("")[1];
            }
            for (var player of ["north", "south", "west", "east"]){
              game.players[player].client.send(JSON.stringify({action: "cardPlayed", card: game.players[order[game.turn]].play, position: order[game.turn]}));
            } 
            break;
          }
        }
        game.advanceTurn();
        for (var player of ["north", "south", "west", "east"]){
          game.players[player].client.send(JSON.stringify({action: "getTurnResult", turn: order[game.turn]}));
        } 
      }
      await sleep(1000);
      var winningCards = ['J'+game.trump, 'J'+match[game.trump], 'A'+game.trump, 'K'+game.trump, 'Q'+game.trump, 'T'+game.trump, 'N'+game.trump, 'A'+game.lead, 'K'+game.lead, 'Q'+game.lead, 'J'+game.lead, 'T'+game.lead, 'N'+game.lead];
      var winIndex = 1000;
      var win = null;
      for (var player of ["north", "south", "west", "east"]){
        for (var i=0; i<winningCards.length; i++){
          if (game.players[player].play == winningCards[i]){
            if (i < winIndex){
              win = player;
              winIndex = i;
              break;
            }
          }
        }
      }
      if (win == 'north' || win == 'south'){
        game.rScores.northsouth++;
      }
      else{
        game.rScores.eastwest++;
      }
      for (var z=0; z<order.length; z++){
        if (order[z] == win){
          game.turn = z;
        }
      }
      for (var player of ["north", "south", "west", "east"]){
        game.players[player].play = null;
        game.players[player].client.send(JSON.stringify({action: "getRoundResult", win: win}))
        game.players[player].client.send(JSON.stringify({action: "getTurnResult", turn: order[game.turn]}));
      } 
    }
    await sleep(1000);
    console.log('round ended')
    if (game.rScores.northsouth > game.rScores.eastwest){
      if (game.calledTrump == "north" || game.calledTrump == "south"){
        if (game.rScores.northsouth == 5){
          game.scores.northsouth+=2;
        }
        else{
          game.scores.northsouth++;
        }
      }
      else{
        if (game.rScores.northsouth == 5){
            game.scores.northsouth+=4;
        }
        else{
          game.scores.northsouth+=2;
        }
      }
    }
    else{
      if (game.calledTrump == "east" || game.calledTrump == "west"){
        if (game.rScores.eastwest == 5){
          game.scores.eastwest+=2
        }
        else{
          game.scores.eastwest++;
        }
      }
      else{
        if (game.rScores.eastwest == 5){
          game.scores.eastwest+=4;
        }
        else{
          game.scores.eastwest+=2;
        }
      }
    }
    game.advanceDealer();
    for (var player of ["north", "south", "west", "east"]){
        game.players[player].play = null;
        game.players[player].client.send(JSON.stringify({action: "getMatchResult", northsouth: game.scores.northsouth, eastwest: game.scores.eastwest}));
    }
    game.trump = null;
    game.calledTrump = null;
    game.lead = null;
    game.rScores = {northsouth: 0, eastwest: 0}
    
  } 

  
  
 // game.players[game.dealer]
  
}
function sleep(ms){
  return new Promise(function(resolve, reject){
    setTimeout(resolve, ms);
  });
}


