-- --------------------------------------------------------
-- 호스트:                          175.118.126.24
-- 서버 버전:                        10.6.22-MariaDB-0ubuntu0.22.04.1 - Ubuntu 22.04
-- 서버 OS:                        debian-linux-gnu
-- HeidiSQL 버전:                  12.11.0.7065
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- 테이블 ipforce.MODEL_INFO_TB 구조 내보내기
CREATE TABLE IF NOT EXISTS `MODEL_INFO_TB` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT '유저 고유 번호',
  `model_code` varchar(50) NOT NULL COMMENT '모델 고유 코드',
  `original_model_code` varchar(50) DEFAULT NULL,
  `task_type` varchar(50) DEFAULT 'project' COMMENT '모델 학습 데이터 종류',
  `source_type` varchar(50) DEFAULT 'project',
  `data_scope` varchar(50) DEFAULT 'project',
  `model_name` varchar(50) DEFAULT NULL COMMENT '모델명',
  `model_status` int(11) NOT NULL DEFAULT 0,
  `model_desc` text DEFAULT NULL COMMENT '모델설명',
  `model_message` text DEFAULT NULL,
  `collection_num` int(11) NOT NULL,
  `version` int(11) NOT NULL,
  `n_unique` int(11) DEFAULT 0,
  `progress` int(11) NOT NULL DEFAULT 0,
  `progress_status` enum('RUNNING','COMPLETED','FAILED') NOT NULL DEFAULT 'RUNNING' COMMENT '모델 학습 상태',
  `epoch` int(11) NOT NULL DEFAULT 0,
  `learning_rate` float NOT NULL DEFAULT 0,
  `batch_size` int(11) NOT NULL DEFAULT 0,
  `max_length` int(11) NOT NULL DEFAULT 0,
  `shuffle` tinyint(1) NOT NULL DEFAULT 0,
  `last_inference_at` datetime DEFAULT NULL,
  `created_datetime` datetime NOT NULL COMMENT '최초 생성 날짜',
  `updated_datetime` datetime DEFAULT NULL COMMENT '마지막 수정 날짜',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=664 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 ipforce.MODEL_INFO_TB:~1 rows (대략적) 내보내기
INSERT INTO `MODEL_INFO_TB` (`id`, `user_id`, `model_code`, `original_model_code`, `task_type`, `source_type`, `data_scope`, `model_name`, `model_status`, `model_desc`, `model_message`, `collection_num`, `version`, `n_unique`, `progress`, `progress_status`, `epoch`, `learning_rate`, `batch_size`, `max_length`, `shuffle`, `last_inference_at`, `created_datetime`, `updated_datetime`) VALUES
	(1, 1, 'cls_proj_20251029_uqkv34', NULL, 'classification', 'upload', 'project', 'CPC 서브 클래스 90개', 1, 'CPC 서브 클래스 90개', NULL, 90, 1, NULL, 100, 'COMPLETED', 20, 0.00001, 128, 256, 1, NULL, '2025-10-29 20:45:31', '2025-10-30 07:39:00');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
