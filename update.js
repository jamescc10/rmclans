// get clans.json data and make info.json and put it into static
// convert some markdown to html

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';

const inputJson = JSON.parse(fs.readFileSync("./input.json"));

// game data
const gameid = "1280770";
const lb = ["7278576","7278567","7278569","7278568","7278574","8917861","8917858","7605131","8046038","7278572","7278570","7278578",];
const lbName = ["Deaths","Level","Free for all losses","Free for all wins","Kills","King of the hill losses","King of the hill wins","Melee kills","No scopes","Team deathmatch losses","Team deathmatch wins","World deaths",];

// get player data
const getLeaderboardData = async (url, lb) => {
    const steamurl = `${url}stats/${gameid}/achievements/?tab=leaderboards&lb=${lb}`;
    const res = await fetch(steamurl);
    const body = await res.text();
    const $ = cheerio.load(body);
    let data = {};

    $('a').each((index, element) => {
        const href = $(element).attr("href");
        if(href) {
            if(href.startsWith(`${url}stats/${gameid}/`)) {
                const score = $(element).parent().parent().parent().children(".scoreh").text().trim();
                const rank = $(element).parent().parent().parent().children(".globalRankh").text().trim();
                const name = $(element).text();
                data = {
                    score: score,
                    rank: rank.slice(13,rank.length),
                    name: name
                };
            }
        }
    });

    return data;
}

const urlToData = async (url) => {
    url = (url[url.length-1] == "/") ? url : url.padEnd(url.length+1,"/");

    let data = {};
    data.score = new Array();
    for(let i = 0; i < lb.length; ++i) {
        let d = await getLeaderboardData(url, lb[i]);
        if(d.name != undefined) {
            data.name = d.name;
            data.score.push([lbName[i], d.rank, d.score]);
        } else {
            data.score.push([lbName[i], "N/A", "N/A"]);
        }
    }

    return data;
}

let clansList = [];
let clansKillList = [];
let playersList = [];
let playerList = []; // only names
let clanList = []; // only names

for(const element of inputJson.clans) {
    let c = element;
    const old = JSON.parse(fs.readFileSync("./output/clans/"+element.title+".json"));
    c.kills_week = old.kills_latest;
    c.kills_2week = old.kills_week;
    c.kills_month = old.kills_2week;
    c.kills_all = 0;
    clansList.push(element);
    clansKillList.push(0);
    clanList.push(element.title);
}

for(const element of inputJson.players) {
    console.log(element);
    let d = await urlToData(element.url);
    d.clan = element.clan;
    // old data
    const old = JSON.parse(fs.readFileSync("./output/players/"+element.id+".json"));
    d.kills_latest = Number(d.score[4][2].replace(/,/g, ''));
    d.kills_week = old.kills_latest;
    d.kills_2week = old.kills_week;
    d.kills_month = old.kills_2week;
    d.url = element.url;
    d.id = element.id;
    clansKillList[element.clan] += d.kills_latest - d.kills_week;
    clansList[d.clan].kills_all += d.kills_latest;
    playersList.push(d);
    playerList.push([d.name, element.url, element.id]);
}

for(let i = 0; i < inputJson.clans.length; ++i) {
    clansList[i].kills_latest = clansKillList[i];
}

console.log("Clans:");
for(const clan of clansList) {
    console.log("\tTitle: "+clan.title);
    console.log("\tPlayers: "+clan.players);
    console.log("\tInfo: "+clan.info);
    console.log("\tRequirements: "+clan.requirements);
    console.log("\tKills (latest):"+clan.kills_latest);
    console.log("\tKills (week):"+clan.kills_week);
    console.log("\tKills (2week): "+clan.kills_2week);
    console.log("\tKills (month):"+clan.kills_month);
    console.log("\n");
}

console.log("\nPlayers:");
for(const player of playersList) {
    console.log("\t"+player.name+":");

    // data
    for(const score of player.score) {
        console.log("\t\tScore: "+score);
    }

    // kills
    console.log("\t\tKills (latest): "+player.kills_latest);
    console.log("\t\tKills (week): "+player.kills_week);
    console.log("\t\tKills (2week): "+player.kills_2week);
    console.log("\t\tKills (month): "+player.kills_month);

    console.log("\t\tClan(s): "+player.clan)
}

console.log(clansKillList);

// write files
// TODO: remove testouput before
fs.rmSync("./output/", {recursive:true, force:true});
fs.mkdirSync("./output/");
fs.mkdirSync("./output/clans/");
fs.mkdirSync("./output/players/");
const outputPlayersJson = JSON.stringify(playerList);
const outputClansJson = JSON.stringify(clanList);
console.log(outputPlayersJson);
console.log(outputClansJson);
fs.writeFileSync("./output/clans.json", `{"clans": ${outputClansJson}}`);
fs.writeFileSync("./output/players.json", `{"players": ${outputPlayersJson}}`);
for(let i = 0; i < clansList.length; ++i) { fs.writeFileSync(`./output/clans/${clansList[i].title}.json`, JSON.stringify(clansList[i])); }
for(let i = 0; i < playersList.length; ++i) { fs.writeFileSync(`./output/players/${playersList[i].id}.json`, JSON.stringify(playersList[i])); }
fs.rmSync("./static/data/", {recursive:true, force:true});
fs.cpSync("./output/", "./static/data/", {recursive:true});