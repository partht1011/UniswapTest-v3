// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";
contract Core {
    using SafeERC20 for IERC20;

    IUniswapV2Router02 public router;
    
    constructor(IUniswapV2Router02 _router) {
        router = _router;
    }

    /**
     */
    function addLiquidity(
        IERC20 token1,
        IERC20 token2,
        uint256 amount1,
        uint256 amount2
    ) external returns (uint amountA, uint amountB, uint liquidity) {
        token1.safeTransferFrom(msg.sender, address(this), amount1);
        token2.safeTransferFrom(msg.sender, address(this), amount2);

        token1.approve(address(router), amount1);
        token2.approve(address(router), amount2);

        return router.addLiquidity(
            address(token1),
            address(token2),
            amount1,
            amount2,
            0,
            0,
            msg.sender,
            block.timestamp
        );
    }

    /**
     */
    function addLiquidityETH(
        IERC20 token,
        uint256 amount
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity){
        token.safeTransferFrom(msg.sender, address(this), amount);
        token.approve(address(router), amount);

        uint ethAmount = msg.value;
        return router.addLiquidityETH{value: ethAmount}(
            address(token), 
            amount, 
            0, 
            0, 
            msg.sender, 
            block.timestamp
        );
    }

    /**
     */
    function removeLiquidity(
        IERC20 tokenA,
        IERC20 tokenB,
        uint256 liquidity
    ) external returns (uint amountA, uint amountB){
        IUniswapV2Factory factory = IUniswapV2Factory(router.factory());
        address pair = factory.getPair(address(tokenA), address(tokenB));
        IERC20 liquidityToken = IERC20(pair);
        liquidityToken.safeTransferFrom(msg.sender, address(this), liquidity);
        liquidityToken.approve(address(router), liquidity);

        return router.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidity,
            0,
            0,
            msg.sender,
            block.timestamp
        );
    }

    /**
     */
    function removeLiquidityETH(
        IERC20 token,
        uint256 liquidity
    ) external returns (uint amountToken, uint amountETH){
        IUniswapV2Factory factory = IUniswapV2Factory(router.factory());
        address pair = factory.getPair(address(token), router.WETH());
        IERC20 liquidityToken = IERC20(pair);
        liquidityToken.safeTransferFrom(msg.sender, address(this), liquidity);
        liquidityToken.approve(address(router), liquidity);

        return router.removeLiquidityETH(
            address(token),
            liquidity,
            0,
            0,
            msg.sender,
            block.timestamp
        );
    }

    /**
     */
    function swapExactTokensForTokens(
        IERC20 token1,
        IERC20 token2,
        uint256 amountIn
    ) external returns (uint amountOut){
        token1.safeTransferFrom(msg.sender, address(this), amountIn);
        token1.approve(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = address(token1);
        path[1] = address(token2);

        return router.swapExactTokensForTokens(
            amountIn,
            0,
            path,
            msg.sender,
            block.timestamp 
        )[1];
    }

    /**
     */
    function swapTokensForExactTokens(
        IERC20 token1,
        IERC20 token2,
        uint256 amountOut,
        uint256 amountInMax
    ) external returns (uint amountIn){
        token1.safeTransferFrom(msg.sender, address(this), amountInMax);
        token1.approve(address(router), amountInMax);

        address[] memory path = new address[](2);
        path[0] = address(token1);
        path[1] = address(token2);

        return router.swapTokensForExactTokens(
            amountOut,
            amountInMax,
            path,
            msg.sender,
            block.timestamp
        )[0];
    }

    /**
     */
    function swapExactETHForTokens(
        IERC20 token
    ) external payable returns (uint256 amountTokens) {
        require(msg.value > 0, "Must send ETH");

        address[] memory path = new address[](2);
        path[0] = router.WETH();
        path[1] = address(token);

        uint256[] memory amounts = router.swapExactETHForTokens{value: msg.value}(
            0,
            path,
            msg.sender,
            block.timestamp
        );
        amountTokens = amounts[amounts.length - 1];
    }

    // Function to allow the contract to receive ETH
    receive() external payable {}
}