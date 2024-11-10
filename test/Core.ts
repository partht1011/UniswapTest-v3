
import { expect } from "chai"
import { getAddress, parseEther } from "ethers"
import { ethers } from "hardhat"
import { Core, IUniswapV2Factory, IUniswapV2Router02, TestToken } from "typechain-types"
import { IERC20 } from './../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20';

describe("Core", () => {
    const ADDRESS__UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    const ADDRESS__UNISWAP_V2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"

    let deployer: any, alice: any, bob: any

    let token1: TestToken
    let token2: TestToken
    let core: Core
    let v2Router: IUniswapV2Router02
    let v2Factory: IUniswapV2Factory

    let token1Addr: any
    let token2Addr: any
    let coreAddr: any

    before(async () => {
        // deploy
        ;[deployer, alice] = await ethers.getSigners()

        const TestTokenFactory = await ethers.getContractFactory("TestToken")
        token1 = await TestTokenFactory.deploy("TT1", "TT1")
        token2 = await TestTokenFactory.deploy("TT2", "TT2")

        v2Router = await ethers.getContractAt("IUniswapV2Router02", ADDRESS__UNISWAP_V2_ROUTER)
        v2Factory = await ethers.getContractAt("IUniswapV2Factory", ADDRESS__UNISWAP_V2_FACTORY)

        const CoreFactory = await ethers.getContractFactory("Core")
        core = await CoreFactory.deploy(ADDRESS__UNISWAP_V2_ROUTER)

        token1Addr = await token1.getAddress()
        token2Addr = await token2.getAddress()
        coreAddr = await core.getAddress()
    })

    describe("Initial Setup", async () => {
        it("should have the correct router address in Core", async () => {
            expect(await core.router()).to.equal(ADDRESS__UNISWAP_V2_ROUTER)
        })

        it("should transfer tokens to Alice", async () => {
            // Transfer tokens to Alice for testing
            await token1.connect(deployer).transfer(alice.address, parseEther("20"))
            await token2.connect(deployer).transfer(alice.address, parseEther("20"))

            expect(await token1.balanceOf(alice.address)).to.equal(parseEther("20"))
            expect(await token2.balanceOf(alice.address)).to.equal(parseEther("20"))
        })
    })

    describe("Add Liquidity", async () => {
        it("should add liquidity successfully", async () => {
            // Alice approves Core to spend her tokens
            await token1.connect(alice).approve(coreAddr, parseEther("4"))
            await token2.connect(alice).approve(coreAddr, parseEther("6"))

            // Add liquidity
            const tx = await core.connect(alice).addLiquidity(
                token1Addr, 
                token2Addr, 
                parseEther("4"), 
                parseEther("6")
            );
            await tx.wait()

        })

        it("should verify token balance post-liquidity addition", async () => {
            const remainingToken1Balance = await token1.balanceOf(alice.address);
            const remainingToken2Balance = await token2.balanceOf(alice.address);

            expect(remainingToken1Balance).to.equal(parseEther("16"));
            expect(remainingToken2Balance).to.equal(parseEther("14"));
        });
    })

    describe("Swapping tokens", () => {
        it("should swap exact tokens for tokens", async () => {

            await token1.connect(alice).approve(coreAddr, parseEther("2"));
            const tx = await core.connect(alice).swapExactTokensForTokens(
                token1Addr,
                token2Addr,
                parseEther("2")
            );
            await tx.wait();

            // Check Alice's balance of token2 increased
            const token1Balance = await token1.balanceOf(alice.address);
            const token2Balance = await token2.balanceOf(alice.address);
            
            expect(token2Balance).to.be.gt(parseEther("14"));
        });

        it("should swap tokens for exact tokens", async () => {
            const amountOut = parseEther("1");
            const amountsIn = await v2Router.getAmountsIn(amountOut, [token1Addr, token2Addr]);
 
            await token1.connect(alice).approve(coreAddr, amountsIn[0]);
            const tx = await core.connect(alice).swapTokensForExactTokens(
                token1Addr,
                token2Addr,
                amountOut,
                amountsIn[0] // maximum amount in
            );
            await tx.wait();

            // Check Alice's balance of token2 matches the desired output
            const token1Balance = await token1.balanceOf(alice.address);
            const token2Balance = await token2.balanceOf(alice.address);
            
            expect(token2Balance).to.be.gte(amountOut);
        });
    });

    describe("Remove Liquidity", async () => {
        it("should remove liquidity successfully", async () => {
            const liquidityPair: any = await v2Factory.getPair(token1Addr, token2Addr);
            const liquidityToken = await ethers.getContractAt("IERC20", liquidityPair);
            const liquidityAmount = await liquidityToken.balanceOf(alice);

            await liquidityToken.connect(alice).approve(coreAddr, liquidityAmount);

            // Remove liquidity
            const tx = await core.connect(alice).removeLiquidity(
                token1Addr, 
                token2Addr,
                liquidityAmount
            );

            // Wait for transaction to be mined
            await tx.wait();
        
            // Check balances after removal
            const amountA = await token1.balanceOf(alice);
            const amountB = await token2.balanceOf(alice);

            expect(amountA).to.be.gt(0);
            expect(amountB).to.be.gt(0);
        })
    })

    describe("Add Liquidity(ETH)", async () => {
        it("should add liquidity ETH", async function () {
            const amountToken = parseEther("10"); // Amount of tokens to add
            const ethAmount = parseEther("10"); // Amount of ETH to add
            const prevBalance = await token1.balanceOf(alice);
            console.log("Alice Prev ETH Amount: " + await ethers.provider.getBalance(alice.address));
            await token1.connect(alice).approve(coreAddr, amountToken);

            // Add liquidity
            const tx = await core.connect(alice).addLiquidityETH(
                token1Addr, 
                amountToken, 
                { value: ethAmount });
            await tx.wait();

            console.log("Alice After ETH Amount: " + await ethers.provider.getBalance(alice.address));
            
            const afterBalance = await token1.balanceOf(alice);;
            expect(prevBalance - afterBalance).to.equal(amountToken);
        });
    });

    describe("Swapping tokens(ETH, token)", () => {
        it("should swap exact ETH for tokens", async () => {
            const ethAmount = parseEther("1"); // Amount of ETH to add
            const prevBalance = await token1.balanceOf(alice);
            const tx = await core.connect(alice).swapExactETHForTokens(
                token1Addr,
                { value: ethAmount }
            );
            await tx.wait();
            
            const afterBalance = await token1.balanceOf(alice);
            expect(afterBalance - prevBalance).gt(0);
        });
    });

    describe("Remove Liquidity(ETH)", async () => {
        it("should remove liquidity ETH successfully", async () => {
            const liquidityPair = await v2Factory.getPair(token1Addr, await v2Router.WETH());
            const liquidityToken = await ethers.getContractAt("IERC20", liquidityPair);
            const liquidityAmount = await liquidityToken.balanceOf(alice);

            await liquidityToken.connect(alice).approve(coreAddr, liquidityAmount);

            // Remove liquidity
            const tx = await core.connect(alice).removeLiquidityETH(
                token1Addr,
                liquidityAmount
            );

            // Wait for transaction to be mined
            await tx.wait();
        
            // Check balances after removal
            const amountA = await token1.balanceOf(alice);
            const amountB = await ethers.provider.getBalance(alice);

            expect(amountA).to.be.gt(0);
            expect(amountB).to.be.gt(0);
        })
    })
})
