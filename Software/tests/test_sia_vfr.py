import copy
from datetime import date, timedelta
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('sia', Path(__file__).resolve().parents[1] / 'tools/update_sia_vfr.py')
sia = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sia)


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.point = {'id': 12, 'txtName': 'PN-S', 'codeId': 'LFPN',
                      'codeType': 'VFR', 'initialCodeType': 'VFR',
                      'coordinates': {'latitude': '484235N', 'longitude': '0020637E'}}
        self.configs = [{'name': 'aixm-effective-date', 'value': date.today().isoformat()}]

    def test_dms_precision_and_hemispheres(self):
        self.assertAlmostEqual(sia.coordinate('484235N', 'lat'), 48 + 42/60 + 35/3600)
        self.assertAlmostEqual(sia.coordinate('0004323.80W', 'lng'), -(43/60 + 23.8/3600))
        self.assertAlmostEqual(sia.coordinate('094301.00S', 'lat'), -(9 + 43/60 + 1/3600))
        self.assertEqual(sia.coordinate('48.75N', 'lat'), 48.75)
        self.assertAlmostEqual(sia.coordinate('00206.5E', 'lng'), 2 + 6.5/60)

    def test_reject_malformed_coordinates(self):
        for value, axis in [('486035N', 'lat'), ('484260N', 'lat'), ('910000N', 'lat'),
                            ('1810000E', 'lng'), ('484235E', 'lat'), ('', 'lat'), ('2E', 'lng')]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                sia.coordinate(value, axis)

    def test_no_invented_obligation_or_altitude(self):
        result, _ = sia.build([self.point], self.configs)
        p = result['points'][0]
        self.assertEqual(p['code'], 'S')
        self.assertIsNone(p['compulsory'])
        self.assertEqual(p['alt'], '')
        self.assertEqual(p['publishedLat'], '484235N')

    def test_deleted_points_are_not_retained(self):
        second = {**self.point, 'id': 13, 'txtName': 'PN-E'}
        before, _ = sia.build([self.point, second], self.configs)
        after, _ = sia.build([second], self.configs)
        self.assertEqual(len(before['points']), 2)
        self.assertEqual([p['id'] for p in after['points']], ['sia-13'])

    def test_reject_empty_duplicates_expired_future(self):
        for points in ([], [self.point, self.point]):
            with self.assertRaises(ValueError):
                sia.build(points, self.configs)
        for offset in (-28, 1):
            config = [{'name': 'aixm-effective-date', 'value': (date.today() + timedelta(days=offset)).isoformat()}]
            with self.assertRaises(ValueError):
                sia.build([self.point], config)

    def test_pagination_completeness(self):
        pages = {'first': {'hydra:member': [1], 'hydra:totalItems': 2,
                          'hydra:view': {'hydra:next': '/api/second'}},
                 'second': {'hydra:member': [2], 'hydra:totalItems': 2}}
        self.assertEqual(sia.collection(pages.__getitem__, 'first'), [1, 2])
        for mutation in ('short', 'loop', 'changed', 'foreign'):
            broken = copy.deepcopy(pages)
            if mutation == 'short': broken['second']['hydra:member'] = []
            if mutation == 'loop': broken['second']['hydra:view'] = {'hydra:next': '/api/first'}
            if mutation == 'changed': broken['second']['hydra:totalItems'] = 3
            if mutation == 'foreign': broken['first']['hydra:view']['hydra:next'] = 'https://example.org/api/second'
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                sia.collection(broken.__getitem__, 'first')


if __name__ == '__main__':
    unittest.main()
