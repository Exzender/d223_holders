const path = require('path');
const fs = require('fs');
const { Web3 } = require('web3');
require('dotenv').config();

const ERC_ABI = require('./erc20_abi.json');
const RPC = 'https://rpc.callisto.network/'; // callisto
// const RPC = 'https://eth.llamarpc.com/'; // eth

const pD223_ADDRESS = '0xf5717D6c1cbAFE00A4c800B227eCe496180244F9'; // callisto
// const pD223_ADDRESS = '0xcce968120e6ded56f32fbfe5a2ec06cbf1e7c8ed'; // eth
// const LAST_BLOCK = BigInt(process.env.ENDBLOCK || '20096039'); // clo = 15672908n // eth = 20096039
const FIRST_BLOCK = BigInt(process.env.STARTBLOCK || '13146356');  // clo = 13146356 // eth = 18691377
const BATCH_SIZE = BigInt(10000);

// const SNAP_BLOCK = BigInt(15599592); // 15 sep 2024 15:00 UTC
const SNAP_BLOCK = BigInt(15626625); // Thu Sep 19 2024 15:00:06 GMT+0000
const LAST_BLOCK = SNAP_BLOCK;           

const holders = new Map();

function addToHolder(address, value) {
    let newVal = value;
    if (holders.has(address)) {
       newVal += holders.get(address);
    }
    holders.set(address, newVal);
}

(async () => {
     // init Web3 provider
    const web3 = new Web3(RPC);
    const netId = await web3.eth.net.getId();
    console.log(`Connected to: ${netId}`);
    
    // const block = await web3.eth.getBlock(15626625n);
    // console.log(block);
    // return;
    
    const fullBlocks = (LAST_BLOCK - FIRST_BLOCK);

    // lp contract
    const contract = new web3.eth.Contract(
        ERC_ABI,
        pD223_ADDRESS
    );

    async function getBalance(address) {
        const balance = await contract.methods.balanceOf(address).call();
        return web3.utils.fromWei(balance, 'ether');
    }

    addToHolder('0xc9bea9379a8fade01240ee583535fac713b71014', 80000000000000000000000000n);

    console.time('getEvents');
    let stopFlag = false;
    for (let i = FIRST_BLOCK; i < LAST_BLOCK; i += BATCH_SIZE) {
        const pcnt = Number(i - FIRST_BLOCK) / Number(fullBlocks) * 100;
        console.log(`block: ${i} -> ${pcnt}%`);
        console.time('getOneBatch');
        const lastBlock = (i + BATCH_SIZE - 1n) > LAST_BLOCK ? LAST_BLOCK : i + BATCH_SIZE - 1n;
        const events = await contract.getPastEvents( 'allEvents', { 
            fromBlock: i,
            toBlock: lastBlock
        });

        // parse transfer LP
        if (events.length) {
            for (let event of events) {
                //     console.dir(event);

                const addressFrom = event.topics[1].replace('000000000000000000000000','');
                const addressTo = event.topics[2].replace('000000000000000000000000','');

                const data = event.data;
                let cleanedData = data.substring(2);
                let next32Digits = cleanedData.substring(32, 64);
                let number = BigInt('0x' + next32Digits);

                addToHolder(addressFrom, -number);
                addToHolder(addressTo, number);
            }
        }
        console.timeEnd('getOneBatch');
    }

    console.timeEnd('getEvents');
    
    let outStr = 'address;pD223\n';
    for (const [key, value] of holders) {
        // const balance = await getBalance(key.toLowerCase());
        const balance = web3.utils.fromWei(value, 'ether');
        if (balance !== '0.') {
            outStr += `${key.toLowerCase()};${balance}\n`;
        }
    }

    fs.writeFileSync(path.resolve(__dirname + '/out', 'pd223_holders_clo_19_09.csv'), outStr, 'utf8');
})();