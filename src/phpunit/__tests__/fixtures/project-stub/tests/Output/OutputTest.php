<?php

namespace Recca0120\VSCode\Tests\Output;

use PHPUnit\Framework\TestCase;

class OutputTest extends TestCase
{
    public function test_echo()
    {
        echo 'printed output';
        self::assertTrue(true);
    }

    public function test_die()
    {
        die('bar');
        self::assertTrue(true);
    }
}