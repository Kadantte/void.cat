<?php
    class Tracking {
        public function TrackDownload($fs, $id) : void {
            $file_size = $fs->GetFileSize($id);

            if(!$this->IsRangeRequest()) {
                $this->TrackView($id);
                Stats::TrackTransfer($id, $file_size);
            } else {
                $range = $this->GetRequestRange($file_size);
                Stats::TrackTransfer($id, $range->end - $range->start);
            }
        }

        public function TrackView($id) : void {
            $redis = StaticRedis::WriteOp();
            $file_key = REDIS_PREFIX . $id;
            $redis->hIncrBy($file_key, 'views', 1);
            $redis->hSet($file_key, 'lastview', time());
        }
        
        function GetRequestRange($len) : ?object {
            if(isset($_SERVER['HTTP_RANGE'])) {
                $rby = explode('=', $_SERVER['HTTP_RANGE']);
                $rbv = explode('-', $rby[1]);
                return (object)array(
                    "start" => intval($rbv[0]),
                    "end" => intval($rbv[1] == "" ? $len : $rbv[1])
                );
            }

            return null;
        }

        function IsRangeRequest() : bool {
            $range = $this->GetRequestRange(0);
            if($range !== null){
                if($range->start != 0){
                    return true;
                }
            }
            return false;
        }

        public static function SendMatomoEvent() : void {
            $msg = "?" . http_build_query(array(
                "idsite" => 3,
                "rec" => 1,
                "apiv" => 1,
                "_id" => isset($_COOKIE["VC:UID"]) ? $_COOKIE["VC:UID"] : uniqid(),
                "url" => (isset($_SERVER['HTTPS']) ? "https" : "http") . "://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]",
                "cip" => USER_IP,
                "ua" => isset($_SERVER["HTTP_USER_AGENT"]) ? $_SERVER["HTTP_USER_AGENT"] : "",
                "urlref" => isset($_SERVER["HTTP_REFERER"]) ? $_SERVER["HTTP_REFERER"] : "",
                "h" => date("H"),
                "m" => date("i"),
                "s" => date("s")
            ));
            
            //this should be sent to the slave node if we are connected on a slave
            StaticRedis::ReadOp()->publish(StaticRedis::$IsConnectedToSlave ? 'v3-matomo' : 'v3-matomo-master', $msg);
        }
    }
?>