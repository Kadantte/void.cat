<?php
    define('REDIS_CONFIG', 'redis-host');
    define('REDIS_PREFIX', 'vc:');
    define('USER_IP', isset($_SERVER['HTTP_CF_CONNECTING_IP']) ? $_SERVER['HTTP_CF_CONNECTING_IP'] : $_SERVER['REMOTE_ADDR']);

    if(!isset($_COOKIE["VC:UID"])) {
		setcookie("VC:UID", uniqid());
    }
    
    spl_autoload_register(function ($class_name) {
        include dirname(__FILE__) . '/' . strtolower($class_name) . '.php';
    });

    //Startup
    if(StaticRedis::Connect() == True) {
        if(isset($_REQUEST["h"])) {
            $handler_name = $_REQUEST["h"];
            if(file_exists($handler_name . '.php')){
                $handler = new $handler_name();
                if($handler instanceof RequestHandler){
                    $handler->HandleRequest();
                    exit();
                }
            }
        }
        //var_dump($_REQUEST);
        http_response_code(400);
        exit();
    } else {
        http_response_code(500);
        exit();
    }
?>