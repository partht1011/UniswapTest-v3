import { expect } from "chai"
import { parseEther } from "ethers"
import { ethers } from "hardhat"
import { Core, INonfungiblePositionManager, IUniswapV3Factory, TestToken } from "typechain-types"

describe("Core", () => {
    const ADDRESS_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984"; // Uniswap V3 Factory
    const ADDRESS_POSITION_MANAGER = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"; // Uniswap V3 NonfungiblePositionManager
    const ADDRESS_SWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // Uniswap V3 SwapRouter

    const POOL_FEE = 3000;

    let deployer: any, alice: any
    let token1: TestToken
    let token2: TestToken
    let core: Core

    let token1Addr: any
    let token2Addr: any
    let coreAddr: any

    let v3Factory: IUniswapV3Factory
    let v3PositionManager: INonfungiblePositionManager

    before(async () => {
        // deploy
        ;[deployer, alice] = await ethers.getSigners()

        const TestTokenFactory = await ethers.getContractFactory("TestToken")
        token1 = await TestTokenFactory.deploy("TT1", "TT1")
        token2 = await TestTokenFactory.deploy("TT2", "TT2")

        const CoreFactory = await ethers.getContractFactory("Core")
        core = await CoreFactory.deploy(ADDRESS_POSITION_MANAGER, ADDRESS_SWAP_ROUTER)

        token1Addr = await token1.getAddress()
        token2Addr = await token2.getAddress()
        coreAddr = await core.getAddress()

        v3Factory = await ethers.getContractAt("IUniswapV3Factory", ADDRESS_FACTORY);
        v3PositionManager = await ethers.getContractAt("INonfungiblePositionManager", ADDRESS_POSITION_MANAGER);

        // set the ratio 1:1
        await v3PositionManager.createAndInitializePoolIfNecessary(token1Addr, token2Addr, POOL_FEE, BigInt(2) ** BigInt(96));
    })

    describe("Initial Setup", async () => {
        it("should have the correct address of router and position manager in Core", async () => {
            expect(await core.router()).to.equal(ADDRESS_SWAP_ROUTER)
            expect(await core.positionManager()).to.equal(ADDRESS_POSITION_MANAGER)
        })

        it("should transfer tokens to Alice", async () => {
            await token1.connect(deployer).transfer(alice, parseEther("30"))
            await token2.connect(deployer).transfer(alice, parseEther("30"))

            expect(await token1.balanceOf(alice)).to.equal(parseEther("30"))
            expect(await token2.balanceOf(alice)).to.equal(parseEther("30"))
        })
    })

    function nearestUsableTick(tick: number, tickSpacing: number): number {
        // Calculate the remainder when dividing the tick by the tick spacing
        const remainder = tick % tickSpacing;

        // If the tick is already a multiple of the tick spacing, return it directly
        if (remainder === 0) {
            return tick;
        }

        // If the tick is not a multiple of the tick spacing, find the nearest usable tick
        // We can either round down or round up to the nearest usable tick
        const lowerTick = tick - remainder;
        const upperTick = tick + (tickSpacing - remainder);

        // Choose the tick that is closest to the original tick
        return Math.abs(tick - lowerTick) < Math.abs(tick - upperTick) ? lowerTick : upperTick;
    }

    describe("Add Liquidity", async () => {
        it("should add liquidity successfully", async () => {
            // Alice approves Core to spend her tokens
            await token1.connect(alice).approve(coreAddr, parseEther("10"))
            await token2.connect(alice).approve(coreAddr, parseEther("10"))
            
            // 0.3% fee tier: tick spacing of 60
            const tickLower = nearestUsableTick(-200, 60);     // Adjust as per price range
            const tickUpper = nearestUsableTick(200, 60);   // Adjust as per price range

            // Add liquidity
            const tx = await core.connect(alice).addLiquidity(
                0,                      // first adding so nftId is 0
                token1Addr,             // address token0
                token2Addr,             // address token1
                parseEther("10"),       // amount0Desired
                parseEther("10"),       // amount1Desired
                POOL_FEE,               // poolFee
                tickLower,              // tickLower
                tickUpper,              // tickUpper
                { gasLimit: 30000000 }
            );

            const receipt: any = await tx.wait();

            if(receipt !== null) {
                // console.log("receipt:", receipt);
                const event = receipt.events?.find((event: any) => event.event === 'LiquidityAdded');

                if(event) {
                    const tokenId = event?.args?.tokenId;
                    console.log("event:", event);
                    console.log("Added NFT id:", tokenId);
                } else {
                    console.log("       No LiquidityAdded event found in transaction receipt.");
                }
            }
            
            const remainingToken1Balance = await token1.balanceOf(alice);
            const remainingToken2Balance = await token2.balanceOf(alice);

            expect(remainingToken1Balance).to.equal(parseEther("20"));
            expect(remainingToken2Balance).to.equal(parseEther("20"));
        });
    })

    describe("Swap Tokens", async () => {
        it("should swap token successfully", async () => {
            // Approve the router to spend the input token
            await token1.connect(alice).approve(coreAddr, parseEther("1"))

            const prevToken1Balance = await token1.balanceOf(alice);
            const prevToken2Balance = await token2.balanceOf(alice);

            // Execute the swap
            const tx = await core.connect(alice).swapTokens(
                token1,
                token2,
                parseEther("1"),
                POOL_FEE
            );
            const receipt = await tx.wait();

            const afterToken1Balance = await token1.balanceOf(alice);
            const afterToken2Balance = await token2.balanceOf(alice);

            expect(prevToken1Balance - afterToken1Balance).to.equal(parseEther("1"));
            expect(afterToken2Balance - prevToken2Balance).to.gt(0);
        });
    })
    // describe("Remove Liquidity", async () => {
    //     it("should remove liquidity successfully", async () => {
    //         // Decrease liquidity from a specific token ID (NFT position)
    //         const tx = await core.removeLiquidity(
    //             tokenId,
    //             liquidity
    //         );

    //         const receipt = await tx.wait();
    //         console.log("Liquidity removed. Transaction receipt:", receipt);
    //     });
    // })
})
