// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/periphery/INonfungiblePositionManager.sol";
import "./interfaces/periphery/ISwapRouter.sol";

contract Core{
    using SafeERC20 for IERC20;

    event LiquidityAdded(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);

    INonfungiblePositionManager public positionManager;
    ISwapRouter public router;
    
    constructor(INonfungiblePositionManager _positionManager, ISwapRouter _router) {
        positionManager = _positionManager;
        router = _router;
    }

    function addLiquidity(
        uint256 nftId,
        address token0,
        address token1,
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint24 poolFee,
        int24 priceLower,
        int24 priceUpper
    ) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) {

        // Transfer tokens to the contract
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0Desired);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1Desired);

        // Approve the Position Manager contract to spend tokens
        IERC20(token0).approve(address(positionManager), amount0Desired);
        IERC20(token1).approve(address(positionManager), amount1Desired);

        if(nftId == 0) {
            // Creating a new position (minting liquidity)
            INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: poolFee, // fee tier (can be 500, 3000, or 10000 for different fee tiers)
                tickLower: int24(priceLower),
                tickUpper: int24(priceUpper),
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: msg.sender,
                deadline: block.timestamp
            });
            (tokenId, liquidity, amount0, amount1) = positionManager.mint(params);
        } else {
            // Increasing liquidity in an existing position
            INonfungiblePositionManager.IncreaseLiquidityParams memory increaseParams = INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,                      // The existing tokenId of the position
                amount0Desired: amount0Desired,        // Amount of token0 to add
                amount1Desired: amount1Desired,        // Amount of token1 to add
                amount0Min: 0,                         // Slippage tolerance for token0
                amount1Min: 0,                         // Slippage tolerance for token1
                deadline: block.timestamp              // Expiry time for the transaction
            });

            // Increase the liquidity of the existing position
            (liquidity, amount0, amount1) = positionManager.increaseLiquidity(increaseParams);
            tokenId = nftId;
        }
        emit LiquidityAdded(tokenId, liquidity, amount0, amount1);
        return (tokenId, liquidity, amount0, amount1);
    }

    function removeLiquidity(
        uint256 tokenId,          // Unique tokenId to identify the liquidity position
        uint128 liquidityAmount  // Amount of liquidity to remove
    ) external returns (uint256 amount0, uint256 amount1) {
        // Ensure the caller is the owner of the position
        require(positionManager.ownerOf(tokenId) == msg.sender, "Not the owner");

        // Call decreaseLiquidity to remove the specified amount of liquidity from the position
        INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams =
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidityAmount,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });

        // Execute decreaseLiquidity
        (amount0, amount1) = positionManager.decreaseLiquidity(decreaseParams);

        // Collect the tokens from the liquidity removal
        INonfungiblePositionManager.CollectParams memory collectParams =
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: msg.sender,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        // Collect the tokens after liquidity removal
        (amount0, amount1) = positionManager.collect(collectParams);

        // Ensure that the withdrawn amounts are above the minimum thresholds to prevent slippage
        require(amount0 >= 0, "Slippage in amount0");
        require(amount1 >= 0, "Slippage in amount1");
    }

    function swapTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 poolFee
    ) external returns (uint256 amountOut) {
        // Transfer tokenIn to this contract
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Approve the router to spend tokenIn
        IERC20(tokenIn).approve(address(router), amountIn);

        // Set up the swap path (tokenIn -> tokenOut)
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: poolFee, // Pool fee (e.g., 500, 3000, or 10000)
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0 // No price limit for this example
        });

        // Execute the swap
        amountOut = router.exactInputSingle(params);
    }
}