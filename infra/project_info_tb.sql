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

-- 테이블 ipforce.PROJECT_INFO_TB 구조 내보내기
CREATE TABLE IF NOT EXISTS `PROJECT_INFO_TB` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL COMMENT '유저 고유번호',
  `source_type` enum('search','upload') NOT NULL,
  `task_type` varchar(50) NOT NULL,
  `project_code` tinytext NOT NULL COMMENT '프로젝트 고유번호',
  `project_status` tinyint(3) NOT NULL DEFAULT 1 COMMENT '프로젝트 진행상태',
  `project_name` varchar(50) NOT NULL COMMENT '프로젝트명',
  `project_description` text NOT NULL COMMENT '프로젝트 설명',
  `collection_num` int(11) DEFAULT 0,
  `labeled_documents` int(11) DEFAULT 0,
  `unlabeled_documents` int(11) DEFAULT 0,
  `temp_category` char(1) DEFAULT NULL,
  `modified` varchar(50) DEFAULT NULL,
  `created_datetime` datetime DEFAULT curdate() COMMENT '최초 생성 날짜',
  `updated_datetime` datetime DEFAULT NULL COMMENT '마지막 수정 날짜',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=127 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 ipforce.PROJECT_INFO_TB:~2 rows (대략적) 내보내기
INSERT INTO `PROJECT_INFO_TB` (`id`, `user_id`, `source_type`, `task_type`, `project_code`, `project_status`, `project_name`, `project_description`, `collection_num`, `labeled_documents`, `unlabeled_documents`, `temp_category`, `modified`, `created_datetime`, `updated_datetime`) VALUES
	(123, 1, 'upload', 'classification', 'proj_20251030_2sekac', 2, 'CPC 서브 클래스 90개', '분야|세부 기술|구체 항목 형식으로 매핑', 90, 3060, 0, NULL, NULL, '2025-10-29 00:00:00', '2025-10-30 07:47:52'),
	(124, 1, 'search', 'classification', 'proj_20251030_hke03m', 2, '전기 컬렉션 모음', '전기 컬렉션 모음', 2, 102, 88, NULL, NULL, '2025-10-29 00:00:00', '2025-10-31 10:45:33');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
